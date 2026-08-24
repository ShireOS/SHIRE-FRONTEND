# Direct Back Office POS Reports

## Ownership boundary

Restaurant ML is the sole digital-report backend for the Back Office POS
Reports page. It owns the browser-authenticated receipt-v3 snapshot, the
ten-minute Redis snapshot record, PDF/XLSX generation, and immediate email.
PDF/XLSX/email always render from the opaque snapshot ID returned with the
visible report; they never accept operational totals from the browser.

The POS backend continues to own native/Android compatibility, server checkout
receipts, thermal preview, physical print delivery, and print-job status. Its
existing Report Hub snapshot/artifact/email routes remain mounted during the
rollout and rollback window.

Authorization is unchanged: Back Office reads and digital outputs require
`reports.view`. This consolidation does not add a permission key.

## Runtime configuration

Restaurant ML requires a shared `REDIS_URL` reachable by every web worker.
Snapshot state must not fall back to process memory.

| Setting | Default | Purpose |
| --- | ---: | --- |
| `BACK_OFFICE_POS_REPORTS_DIRECT_ENABLED` | `false` | Mounts the dark-launch capability in `/readyz` and permits direct requests. |
| `REPORT_SNAPSHOT_TTL_SECONDS` | `600` | Visible snapshot/artifact/email lifetime. |
| `REPORT_SNAPSHOT_REQUEST_TTL_SECONDS` | `60` | Equivalent-request deduplication window. |
| `REPORT_SNAPSHOT_LOCK_SECONDS` | `30` | Distributed cold-build lock lifetime. |
| `VITE_DIRECT_POS_REPORTS_ENABLED` | `false` | Frontend cutover/rollback flag. |

Restaurant ML emits `Server-Timing` and structured
`restaurant_reports.performance` events for snapshots, artifacts, and email.
The promotion gates are weekly Long preview p95 under 3 seconds and cached PDF
p95 under 1 second.

## Release sequence

1. Deploy Restaurant ML with `BACK_OFFICE_POS_REPORTS_DIRECT_ENABLED=false`.
   Verify the three `/reports/pos-snapshots` operations in OpenAPI, Redis
   connectivity, receipt-v3 tests, and the native-to-ML projection parity guard.
2. Run production shadow comparisons on representative restaurant weeks.
   Every PDF-visible server/tip value must match. Old and new PDFs must match
   filename, page count, media dimensions, extracted text, section/table order,
   and layout signature after excluding generation timestamps and PDF metadata.
3. Enable `BACK_OFFICE_POS_REPORTS_DIRECT_ENABLED=true`; confirm `/readyz`
   advertises `back_office_pos_reports.direct.v1` and authenticated snapshot,
   artifact, expiry, cross-tenant, and email smoke tests pass.
4. Deploy Shire Frontend with `VITE_DIRECT_POS_REPORTS_ENABLED=true`. The
   production contract verifier requires the direct ML capability only for this
   flagged build and continues to require all POS compatibility/print routes.
5. Observe latency, cache-hit, expiry, authorization, render, and delivery error
   metrics before promotion. Do not remove POS compatibility endpoints as part
   of this rollout.

## Verification commands

```sh
# Restaurant ML
.venv/bin/python scripts/verify_pos_projection_parity.py
.venv/bin/pytest -q tests/services/test_pos_receipt_report_service.py \
  tests/services/test_report_artifact_service.py \
  tests/services/test_report_snapshot_store.py \
  tests/services/test_pos_projection_tip_engine.py \
  tests/services/test_pos_projection_manager_tips.py \
  tests/services/test_pos_projection_server_day.py \
  tests/api/test_direct_pos_reports_api.py \
  tests/api/test_pos_report_contract.py tests/api/test_restaurant_reports_api.py

# POS compatibility
.venv/bin/pytest -q tests/test_manager_report_contract.py tests/test_manager_report_hub.py

# Shire Frontend
node --test apps/web/src/dashboard/reports/*.test.js apps/web/src/shared/api/*.test.js
node --test scripts/verify-production-contracts.test.mjs
cd apps/web && ./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build
```

## Rollback

Set `VITE_DIRECT_POS_REPORTS_ENABLED=false` and redeploy the frontend. This
returns Back Office digital actions to the retained POS Report Hub proxy without
changing receipt-v3 content or physical printing. Keep Restaurant ML's direct
feature available for investigation, or disable
`BACK_OFFICE_POS_REPORTS_DIRECT_ENABLED` after the frontend rollback is active.
Opaque snapshot IDs are short-lived and carry no durable financial mutation.
