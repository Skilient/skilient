// Email through Azure Communication Services (decisions.md 2026-11-28, W9: replaces Brevo). An Email Communication
// Service with the customer-managed domain skilient.com and its two senders, linked to a Communication Services
// resource that notify calls with the core-a identity (no key). Both are global resources; their data stays in the
// UAE. The domain's DNS records (verification TXT, SPF, two DKIM CNAMEs) live in skilient.com's DNS (Vercel today),
// and linking needs the domain verified: see docs/azure/setup-checklist.md, section 4.
param prefix string
param domainName string = 'skilient.com'
param dataLocation string = 'UAE'
@description('false creates the email service and domain only; link once the domain is verified (DNS).')
param linkDomain bool = true

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${prefix}-email'
  location: 'global'
  properties: {
    dataLocation: dataLocation
  }
}

resource domain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: domainName
  location: 'global'
  properties: {
    domainManagement: 'CustomerManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource notifySender 'Microsoft.Communication/emailServices/domains/senderUsernames@2023-04-01' = {
  parent: domain
  name: 'notify'
  properties: {
    username: 'notify'
    displayName: 'Skilient'
  }
}

resource securitySender 'Microsoft.Communication/emailServices/domains/senderUsernames@2023-04-01' = {
  parent: domain
  name: 'security'
  properties: {
    username: 'security'
    displayName: 'Skilient'
  }
}

resource comms 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${prefix}-comms'
  location: 'global'
  properties: {
    dataLocation: dataLocation
    linkedDomains: linkDomain ? [domain.id] : []
  }
}

output communicationName string = comms.name
output emailEndpoint string = 'https://${comms.properties.hostName}'
