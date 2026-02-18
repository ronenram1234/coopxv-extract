# Rollback Workflow

## When to Rollback
- Critical production bug
- Performance degradation
- Data corruption risk

## Emergency Rollback (Ronen coordinates)

**Step 1: Immediate Actions (Michael)**
- Stop deployments
- Identify last good state

**Step 2: Execute (Michael)**
- Rollback code to save point
- Rollback database migrations

**Step 3: Verify (Lisa)**
- System operational
- Critical paths working

**Step 4: Post-Mortem (Ronen)**
- Document incident
- Root cause analysis
