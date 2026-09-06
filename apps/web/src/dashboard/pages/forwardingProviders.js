export const FORWARDING_PROVIDERS = [
  {
    id: 'verizon_business',
    label: 'Verizon Business',
    product: 'Business Digital Voice or business landline',
    accountUrl: 'https://businessdigitalvoice.verizon.com/',
    instructionsUrl: 'https://businessdigitalvoice.verizon.com/end-user-portal-support-ata-and-phone-codes/',
    allCalls: [
      'From the restaurant phone, dial *72.',
      'Enter the Shire AI number shown below, then press # if prompted.',
      'Wait for the confirmation tone or answer the destination call.',
    ],
    missedCalls: [
      'For busy calls, dial *90, enter the Shire AI number, then press #.',
      'For unanswered calls, dial *92, enter the Shire AI number, then press #.',
      'Use the Verizon portal to choose the no-answer ring count when available.',
    ],
  },
  {
    id: 'att_business',
    label: 'AT&T Business',
    product: 'AT&T Phone for Business',
    accountUrl: 'https://www.att.com/acctmgmt/login',
    instructionsUrl: 'https://www.att.com/support/smallbusiness/article/smb-local-long-distance/KM1181691/',
    allCalls: [
      'From the restaurant phone, dial *72.',
      'Enter the Shire AI number shown below, then press #.',
      'Wait for AT&T to confirm forwarding is active.',
    ],
    missedCalls: [
      'For busy calls, dial *90, enter the Shire AI number, then press #.',
      'For unanswered calls, dial *92, enter the Shire AI number, then press #.',
      'You can also configure both under Phone Features in the AT&T account portal.',
    ],
  },
  {
    id: 'comcast_business',
    label: 'Comcast Business',
    product: 'Business Voice or VoiceEdge',
    accountUrl: 'https://business.comcast.com/account',
    instructionsUrl: 'https://business.comcast.com/welcome',
    allCalls: [
      'Open Call Forwarding in the Comcast Business app or VoiceEdge portal.',
      'Choose forwarding for all calls and enter the Shire AI number shown below.',
      'Save the setting and confirm it is enabled.',
    ],
    missedCalls: [
      'Open Call Forwarding in the Comcast Business app or VoiceEdge portal.',
      'Set both No Answer and Busy forwarding to the Shire AI number shown below.',
      'Choose the no-answer delay, save, and confirm both settings are enabled.',
    ],
  },
  {
    id: 'spectrum_business',
    label: 'Spectrum Business',
    product: 'Spectrum Business Voice',
    accountUrl: 'https://www.spectrumbusiness.net/login',
    instructionsUrl: 'https://www.spectrum.com/business/small-business/phone',
    allCalls: [
      'Sign in and open Voice Settings, then Forwarding Manager.',
      'Enable Call Forwarding Unconditional to the Shire AI number shown below.',
      'Save the setting and confirm forwarding is active.',
    ],
    missedCalls: [
      'Sign in and open Voice Settings, then Forwarding Manager.',
      'Enable Call Forwarding Busy and Call Forwarding No Answer to the Shire AI number.',
      'Save both settings and choose the desired no-answer delay if offered.',
    ],
  },
  {
    id: 'ringcentral',
    label: 'RingCentral',
    product: 'RingEX or RingCentral app',
    accountUrl: 'https://app.ringcentral.com/',
    instructionsUrl: 'https://support.ringcentral.com/shared/content/app/setting-up-user-call-forwarding-in-the-ringcentral-app-desktop-a.html',
    allCalls: [
      'Open Settings, select Phone, and edit Call handling.',
      'Add the Shire AI number as an external forwarding number.',
      'Place it first in the incoming-call ring order, then save.',
    ],
    missedCalls: [
      'Open Settings, select Phone, and edit Call handling.',
      'Under Missed calls, choose Forward to external number.',
      'Enter the Shire AI number shown below and save.',
    ],
  },
  {
    id: 'other',
    label: 'Other provider or PBX',
    product: 'Another carrier, hosted phone service, or on-site PBX',
    accountUrl: null,
    instructionsUrl: null,
    allCalls: [
      'Open your provider or phone-system call-routing settings.',
      'Set unconditional or always forwarding to the Shire AI number shown below.',
      'Save the change. Contact the provider if your plan does not expose forwarding controls.',
    ],
    missedCalls: [
      'Open your provider or phone-system call-routing settings.',
      'Set both busy and no-answer forwarding to the Shire AI number shown below.',
      'Save the change and choose the desired no-answer delay if available.',
    ],
  },
]

export function forwardingProviderById(providerId) {
  return FORWARDING_PROVIDERS.find((provider) => provider.id === providerId) || null
}
