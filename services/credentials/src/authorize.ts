import type { CredentialsService } from "@skilient/contracts/credentials/v1/credentials_pb";
import type { CallerPolicy } from "@skilient/platform";

const WEB = ["web"] as const;

/**
 * Which callers may use each method; the gate refuses anyone else before the body is read. Web calls every method
 * (the reader comes from the token; anonymous readers verify codes, open share links and read the key file); the
 * staff methods check the role and two-factor themselves. No other service calls credentials: what it owes others
 * goes as events (record.sealed, record.revoked, cv.issued, milestones).
 */
export const callers: CallerPolicy<typeof CredentialsService> = {
  myCv: WEB,
  cvExportRights: WEB,
  saveCvSettings: WEB,
  issueCv: WEB,
  revokeCv: WEB,
  createCvShareLink: WEB,
  revokeCvShareLink: WEB,
  openSharedCv: WEB,
  verifyCv: WEB,
  recordCvExport: WEB,
  publicKeys: WEB,
  requestPdf: WEB,
  pdfStatus: WEB,
  opsCvRecords: WEB,
  opsRevokeCv: WEB,
  myRecord: WEB,
  setRecordDisplay: WEB,
  reportRecordMistake: WEB,
  createRecordShareLink: WEB,
  revokeRecordShareLink: WEB,
  openRecordShare: WEB,
  recordHighlights: WEB,
  recordWaiting: WEB,
  claimRecordEntries: WEB,
  saveCvActivities: WEB,
  cvActivityOptions: WEB,
  myEntries: WEB,
  recordPdfExport: WEB,
  verifyRecordEntry: WEB,
  verifyRecordTranscript: WEB,
  societyRecordPage: WEB,
  confirmRecordEntry: WEB,
  correctRecordEntry: WEB,
  declineRecordMistake: WEB,
  revokeRecordEntry: WEB,
  opsRecordEntry: WEB,
  noticeFacts: ["notify"],
};
