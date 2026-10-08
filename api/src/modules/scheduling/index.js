import logger from '../../utils/logger.js';
import moment from 'moment-timezone';
import config from '../../config/index.js';

class SchedulingModule {
  constructor() {
    this.name = 'scheduling';
    this.businessHours = {
      start: config.businessHours.start,
      end: config.businessHours.end,
      timezone: config.businessHours.timezone,
      days: config.businessHours.days.split(',').map(d => parseInt(d)),
    };
  }

  /**
   * Handle scheduling inquiry
   */
  async handle(message, context, user) {
    try {
      logger.info('Handling scheduling inquiry');

      const intent = this.detectIntent(message);
      const response = {
        module: this.name,
        intent,
        suggestions: [],
        actions: [],
      };

      switch (intent) {
        case 'book_appointment':
          const availableSlots = this.getAvailableSlots(3);
          response.suggestions.push(
            'I can help you schedule an appointment.',
            'Here are some available times:',
            ...availableSlots.map((slot, i) => `${i + 1}. ${slot}`),
          );
          response.actions.push({
            type: 'schedule_appointment',
            availableSlots,
          });
          break;

        case 'reschedule':
          response.suggestions.push(
            'I can help you reschedule your appointment.',
            'Please provide your current appointment details or confirmation number.',
          );
          response.actions.push({
            type: 'request_appointment_details',
          });
          break;

        case 'cancel':
          response.suggestions.push(
            'I can help cancel your appointment.',
            'Please provide your confirmation number.',
          );
          response.actions.push({
            type: 'cancel_appointment',
          });
          break;

        case 'check_availability':
          response.suggestions.push(
            'Let me check our availability.',
            'What date were you thinking of?',
          );
          break;

        default:
          response.suggestions.push(
            'How can I help with scheduling?',
            'I can book, reschedule, or cancel appointments.',
          );
      }

      return response;
    } catch (error) {
      logger.error('Error in scheduling module:', error);
      return { module: this.name, suggestions: [], actions: [] };
    }
  }

  /**
   * Detect specific intent
   */
  detectIntent(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.match(/book|schedule|appointment|meeting|reserve/)) {
      return 'book_appointment';
    }

    if (lowerMessage.match(/reschedule|change|move|different time/)) {
      return 'reschedule';
    }

    if (lowerMessage.match(/cancel|cancel appointment/)) {
      return 'cancel';
    }

    if (lowerMessage.match(/available|availability|free|open slot/)) {
      return 'check_availability';
    }

    return 'general';
  }

  /**
   * Get available appointment slots
   */
  getAvailableSlots(days = 3, slotsPerDay = 2) {
    const slots = [];
    const now = moment().tz(this.businessHours.timezone);
    let daysChecked = 0;
    let currentDay = now.clone();

    while (daysChecked < days) {
      currentDay.add(1, 'day');
      
      // Check if it's a business day
      if (this.businessHours.days.includes(currentDay.day())) {
        const morning = currentDay.clone().hour(10).minute(0).second(0);
        const afternoon = currentDay.clone().hour(14).minute(0).second(0);
        
        slots.push(morning.format('dddd, MMMM D [at] h:mm A'));
        if (slotsPerDay > 1) {
          slots.push(afternoon.format('dddd, MMMM D [at] h:mm A'));
        }
        
        daysChecked++;
      }
    }

    return slots;
  }

  /**
   * Check if time is within business hours
   */
  isBusinessHours(dateTime) {
    const time = moment(dateTime).tz(this.businessHours.timezone);
    const day = time.day();
    const hour = time.format('HH:mm');

    return (
      this.businessHours.days.includes(day) &&
      hour >= this.businessHours.start &&
      hour <= this.businessHours.end
    );
  }

  /**
   * Get module context
   */
  getContext() {
    return {
      module: this.name,
      description: 'Appointment and meeting management',
      capabilities: [
        'Book appointments',
        'Reschedule appointments',
        'Cancel appointments',
        'Check availability',
        'Send appointment reminders',
      ],
    };
  }
}

export default SchedulingModule;
