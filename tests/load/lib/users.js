// The seeder's account names, shared so k6 and scripts/load/seed.mjs can't drift (tests/unit/load-test.test.ts).
export { loadEmail as userEmail, loadUsername as username, officerEmail, pairOf as partnerOf } from "../../../scripts/load/lib.mjs";
