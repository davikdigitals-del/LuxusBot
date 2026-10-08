import express from 'express';
import crypto from 'crypto';
import { User, Business } from '../models/index.js';
import { authenticate, requireBusiness, requireRole, requireOwner } from '../middleware/auth.js';
import emailService from '../services/emailService.js';
import logger from '../utils/logger.js';
import { sha256 } from '../utils/crypto.js';

const router = express.Router();

const ROLES = ['owner', 'admin', 'agent', 'viewer'];

const publicMember = (user, businessId) => {
  const membership = user.memberships.find(m => String(m.businessId) === String(businessId));
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    role: membership?.role,
    status: membership?.status,
    departments: membership?.departments || [],
    invitedAt: membership?.invitedAt,
    joinedAt: membership?.joinedAt,
    lastLogin: user.lastLogin,
  };
};

/**
 * @route   GET /api/business/:id/team
 * @desc    List members of a business
 * @access  Private (any role)
 */
router.get('/:id/team', authenticate, requireBusiness, async (req, res) => {
  try {
    const users = await User.find({ 'memberships.businessId': req.businessId, status: { $ne: 'deleted' } });
    const members = users.map(u => publicMember(u, req.businessId));
    const business = await Business.findById(req.businessId).select('departments');
    res.json({ success: true, members, departments: business?.departments || [] });
  } catch (error) {
    logger.error('Error listing team:', error);
    res.status(500).json({ success: false, error: 'Failed to list team' });
  }
});

router.post('/:id/team/departments', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ').toLowerCase() : '';
    if (!/^[a-z0-9][a-z0-9 _-]{0,29}$/.test(name)) {
      return res.status(400).json({ success: false, error: 'Department name must be 1-30 letters, numbers, spaces, hyphens or underscores' });
    }
    const business = await Business.findById(req.businessId);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
    if (business.departments.includes(name)) {
      return res.status(409).json({ success: false, error: 'That department already exists' });
    }
    if (business.departments.length >= 20) {
      return res.status(400).json({ success: false, error: 'A business can have up to 20 departments' });
    }
    business.departments.push(name);
    await business.save();
    res.status(201).json({ success: true, departments: business.departments });
  } catch (error) {
    logger.error('Error creating department:', error);
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
});

router.delete('/:id/team/departments/:name', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const name = typeof req.params.name === 'string' ? req.params.name.trim().replace(/\s+/g, ' ').toLowerCase() : '';
    const business = await Business.findById(req.businessId);
    if (!business) return res.status(404).json({ success: false, error: 'Business not found' });
    if (!business.departments.includes(name)) {
      return res.status(404).json({ success: false, error: 'Department not found' });
    }

    business.departments = business.departments.filter((department) => department !== name);
    await business.save();
    await User.updateMany(
      { 'memberships.businessId': req.businessId, 'memberships.departments': name },
      { $pull: { 'memberships.$[membership].departments': name } },
      { arrayFilters: [{ 'membership.businessId': req.businessId }] },
    );

    res.json({ success: true, departments: business.departments });
  } catch (error) {
    logger.error('Error deleting department:', error);
    res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
});

/**
 * @route   POST /api/business/:id/team/invite
 * @desc    Invite a teammate by email using a single-use, expiring invitation token.
 * @access  Private (admin, owner)
 */
router.post('/:id/team/invite', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { email, role } = req.body || {};
    const department = typeof req.body?.department === 'string' ? req.body.department.trim().toLowerCase() : '';

    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      return res.status(400).json({ success: false, error: 'A valid email is required' });
    }
    if (!ROLES.includes(role) || role === 'owner') {
      return res.status(400).json({ success: false, error: `role must be one of: ${ROLES.filter(r => r !== 'owner').join(', ')}` });
    }
    // Only an owner can hand out admin (prevents an admin from promoting peers to admin)
    if (role === 'admin' && req.userRole !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only the business owner can invite admins' });
    }

    const business = await Business.findById(req.businessId);
    if (!department || !business?.departments.includes(department)) {
      return res.status(400).json({ success: false, error: 'Create and select a department before inviting a teammate' });
    }
    const normalizedEmail = email.toLowerCase().trim();

    const memberCount = await User.countDocuments({ 'memberships.businessId': req.businessId, status: { $ne: 'deleted' } });
    if (memberCount >= business.limits.maxTeamMembers) {
      return res.status(403).json({ success: false, error: `Team member limit reached (${business.limits.maxTeamMembers}) for your plan` });
    }

    let user = await User.findOne({ email: normalizedEmail });
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitationTokenHash = sha256(inviteToken);
    let createdUser = false;
    let membership;

    if (user) {
      if (user.memberships.some(m => String(m.businessId) === String(req.businessId))) {
        return res.status(400).json({ success: false, error: 'This person is already a member' });
      }
      user.memberships.push({
        businessId: req.businessId,
        role,
        invitedBy: req.userId,
        status: 'pending',
        departments: [department],
        invitationTokenHash,
        invitationExpiresAt,
        inviteRequiresPassword: false,
      });
      membership = user.memberships[user.memberships.length - 1];
      await user.save();
    } else {
      const tempPassword = crypto.randomBytes(24).toString('hex');

      user = new User({
        email: normalizedEmail,
        password: tempPassword, // hashed by the User pre-save hook; never used - invite flow sets a real one
        firstName: 'Invited',
        lastName: 'User',
        emailVerified: false,
        memberships: [{
          businessId: req.businessId,
          role,
          invitedBy: req.userId,
          status: 'pending',
          departments: [department],
          invitationTokenHash,
          invitationExpiresAt,
          inviteRequiresPassword: true,
        }],
      });
      await user.save();
      membership = user.memberships[0];
      createdUser = true;
    }

    try {
      await emailService.sendTeamInvitation(normalizedEmail, {
        businessName: business.name,
        inviterName: `${req.user.firstName} ${req.user.lastName}`,
        role,
        department,
        inviteToken,
      });
    } catch (emailError) {
      try {
        if (createdUser) {
          await User.deleteOne({ _id: user._id });
        } else {
          user.memberships.pull({ _id: membership._id });
          await user.save();
        }
      } catch (rollbackError) {
        logger.error('Failed to roll back unsent team invitation:', rollbackError);
      }
      logger.error('Team invite email failed:', emailError);
      return res.status(502).json({ success: false, error: 'Invitation email could not be sent. Please try again later.' });
    }

    res.status(201).json({
      success: true,
      member: publicMember(user, req.businessId),
      message: 'Invitation sent',
    });
  } catch (error) {
    logger.error('Error inviting team member:', error);
    res.status(500).json({ success: false, error: 'Failed to invite team member' });
  }
});

/**
 * @route   PUT /api/business/:id/team/:userId
 * @desc    Change a member's role
 * @access  Private (owner only - keeps privilege escalation to a single role)
 */
router.put('/:id/team/:userId', authenticate, requireBusiness, requireOwner, async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: `role must be one of: ${ROLES.join(', ')}` });
    }

    const user = await User.findById(req.params.userId);
    const membership = user?.memberships.find(m => String(m.businessId) === String(req.businessId));

    if (!user || !membership) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    if (membership.role === 'owner' && String(user._id) === String(req.userId) && role !== 'owner') {
      return res.status(400).json({ success: false, error: "Transfer ownership before changing your own role" });
    }

    membership.role = role;
    membership.status = 'active';
    await user.save();

    res.json({ success: true, member: publicMember(user, req.businessId) });
  } catch (error) {
    logger.error('Error updating member role:', error);
    res.status(500).json({ success: false, error: 'Failed to update member role' });
  }
});

/**
 * @route   DELETE /api/business/:id/team/:userId
 * @desc    Remove a member from a business
 * @access  Private (admin, owner)
 */
router.delete('/:id/team/:userId', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    if (String(req.params.userId) === String(req.userId)) {
      return res.status(400).json({ success: false, error: 'Use a role transfer instead of removing yourself' });
    }

    const user = await User.findById(req.params.userId);
    const membership = user?.memberships.find(m => String(m.businessId) === String(req.businessId));

    if (!user || !membership) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    if (membership.role === 'owner') {
      return res.status(400).json({ success: false, error: 'Transfer ownership before removing the owner' });
    }
    // Only an owner can remove another admin
    if (membership.role === 'admin' && req.userRole !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only the business owner can remove an admin' });
    }

    user.memberships = user.memberships.filter(m => String(m.businessId) !== String(req.businessId));
    await user.save();

    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    logger.error('Error removing team member:', error);
    res.status(500).json({ success: false, error: 'Failed to remove team member' });
  }
});

/**
 * @route   PUT /api/business/:id/team/:userId/departments
 * @desc    Set the departments (routing tags) a member handles
 * @access  Private (admin, owner)
 */
router.put('/:id/team/:userId/departments', authenticate, requireBusiness, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { departments } = req.body || {};
    if (!Array.isArray(departments) || departments.length > 10) {
      return res.status(400).json({ success: false, error: 'departments must be an array of up to 10 names' });
    }
    const clean = [...new Set(departments
      .filter((d) => typeof d === 'string')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => /^[a-z0-9][a-z0-9 _-]{0,29}$/.test(d)))];
    const business = await Business.findById(req.businessId).select('departments');
    if (clean.some((department) => !business?.departments.includes(department))) {
      return res.status(400).json({ success: false, error: 'Members can only be assigned to departments that already exist' });
    }

    const user = await User.findById(req.params.userId);
    const membership = user?.memberships.find(m => String(m.businessId) === String(req.businessId));
    if (!user || !membership) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    membership.departments = clean;
    await user.save();
    res.json({ success: true, member: publicMember(user, req.businessId) });
  } catch (error) {
    logger.error('Error updating member departments:', error);
    res.status(500).json({ success: false, error: 'Failed to update departments' });
  }
});

export default router;
