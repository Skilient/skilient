"""Merge a session's tasks, findings, cw and plan fixes into docs/ux-pilot/results.json (replacing same ids). Used by the per-session result scripts."""
import json, os, sys
os.chdir('/home/user/skilient')
def merge(tasks=(), findings=(), cw=(), plan=()):
    p='docs/ux-pilot/results.json'; r=json.load(open(p))
    shots=sorted(os.listdir('docs/ux-pilot/shots'))
    for t in tasks: t['shots']=[f"docs/ux-pilot/shots/{s}" for s in shots if s.startswith(t['id']+'-')]
    tid={t['id'] for t in tasks}; r['tasks']=[t for t in r['tasks'] if t['id'] not in tid]+list(tasks)
    r['tasks'].sort(key=lambda t:t['id'])
    fid={f['id'] for f in findings}; r['findings']=[f for f in r['findings'] if f['id'] not in fid]+list(findings)
    keys={(c['step'],c['task']) for c in cw}; r['cw']=[c for c in r['cw'] if (c['step'],c['task']) not in keys]+list(cw)
    pk={x['tasks'] for x in plan}; r['plan_fixes']=[x for x in r['plan_fixes'] if x['tasks'] not in pk]+list(plan)
    json.dump(r,open(p,'w'),indent=1,ensure_ascii=False)
    print(len(r['tasks']),'tasks',len(r['findings']),'findings',len(r['cw']),'cw')
def T(id,status,answers,findings,note="",clicks=None,shortest=None):
    return {"id":id,"status":status,"answers":answers,"findings":findings,"note":note,"shots":[],"clicks":clicks,"shortest":shortest}
def F(id,sev,where,what,repro,tasks,pr,fix,same=""):
    return {"id":id,"severity":sev,"where":where,"what":what,"repro":repro,"tasks":tasks,"principles":pr,"fix":fix,"same_as":same}
def C(step,task,q,why): return {"step":step,"task":task,"q":q,"why":why}
def P(tasks,change): return {"tasks":tasks,"change":change}
