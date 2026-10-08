'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import RequireAuth from '@/components/RequireAuth';

const steps = [
  ['businessInfo','Business information','Complete your business profile in Settings.','/dashboard/settings'],
  ['whatsappConnected','Connect WhatsApp','Connect the business WhatsApp number.','/dashboard/whatsapp'],
  ['assistantCustomized','Customize your assistant','Set its name, personality and instructions.','/dashboard/settings'],
  ['knowledgeBaseAdded','Add knowledge','Upload FAQs, policies, products or other documents.','/dashboard/knowledge'],
  ['planSelected','Subscription','Choose a plan in Billing whenever you are ready to activate AI replies.','/dashboard/billing'],
];

function Content() {
  const { currentBusinessId } = useAuth(); const router = useRouter(); const [state,setState]=useState(null);
  useEffect(()=>{ if(currentBusinessId) api.get(`/api/business/${currentBusinessId}/onboarding`).then(setState).catch(()=>{}); },[currentBusinessId]);
  const finish = async () => {
    const updates = Object.fromEntries(steps.map(([key]) => [
      key,
      key === 'planSelected' ? Boolean(state?.business?.plan && state.business.plan !== 'none') : true,
    ]));
    await api.put(`/api/business/${currentBusinessId}/onboarding`, updates);
    router.push('/dashboard');
  };
  return <main className="min-h-screen bg-stone-50 px-6 py-12"><div className="mx-auto max-w-2xl"><p className="text-sm text-brass-dark">Luxus Bot setup</p><h1 className="mt-2 font-display text-4xl text-ink-900">Get your workspace ready</h1><p className="mt-2 text-ink-600">Complete these steps now or return to them later.</p><div className="mt-8 space-y-3">{steps.map(([key,title,desc,href],i)=>{const done=!!state?.onboarding?.steps?.[key];return <div key={key} className="flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${done?'bg-emerald-100 text-emerald-800':'bg-stone-100 text-ink-700'}`}>{done?'✓':i+1}</div><div className="flex-1"><h2 className="font-medium">{title}</h2><p className="text-sm text-ink-600">{desc}</p></div><button onClick={()=>router.push(href)} className="text-sm text-brass-dark">{done?'Review':'Open'} →</button></div>})}</div><button onClick={finish} className="mt-6 w-full rounded bg-ink-900 px-4 py-3 text-sm font-medium text-white">Finish setup</button></div></main>;
}
export default function OnboardingPage(){return <RequireAuth><Content/></RequireAuth>}
