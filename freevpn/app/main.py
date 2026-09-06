from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, PlainTextResponse, StreamingResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
import os, pathlib, subprocess, ipaddress, json, io, qrcode, re, time, hmac, hashlib, secrets

app = FastAPI(title='FreeVPN', docs_url=None, redoc_url=None)
templates = Jinja2Templates(directory='/app/app/templates')
app.mount('/static', StaticFiles(directory='/app/app/static'), name='static')
DATA = pathlib.Path('/data'); CLIENTS = DATA/'clients'; WG = DATA/'wg0.conf'
TOKEN = os.environ['ADMIN_TOKEN']
ENDPOINT = os.environ['VPN_ENDPOINT']
PORT = int(os.getenv('VPN_PORT','51820'))
SUBNET = ipaddress.ip_network(os.getenv('VPN_SUBNET','10.66.66.0/24'))
COOKIE_SECURE = os.getenv('COOKIE_SECURE','true').lower() not in ('0','false','no')
SECRET_FILE = DATA/'session_secret.key'
NUU_VPN_URL = os.getenv('NUU_VPN_URL','https://sslvpn.nuu.edu.tw/sslvpn/Login/Login')
NUU_HELP_URL = os.getenv('NUU_HELP_URL','https://ccenter.nuu.edu.tw/p/412-1007-295.php')
NUU_LIBRARY_URL = os.getenv('NUU_LIBRARY_URL','https://mobilelibrary.nuu.edu.tw/')
OPENSCITE_FILE = pathlib.Path('/app/app/static/openscite/index.html')
AUTOMATION_ZIP = pathlib.Path('/app/app/static/downloads/openscite-browser-automation-v10.zip')


def ensure_secret():
    DATA.mkdir(parents=True, exist_ok=True)
    if not SECRET_FILE.exists():
        SECRET_FILE.write_text(secrets.token_hex(32))
        os.chmod(SECRET_FILE, 0o600)
    return SECRET_FILE.read_text().strip().encode()

SESSION_SECRET = ensure_secret()

@app.middleware('http')
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault('X-Content-Type-Options','nosniff')
    response.headers.setdefault('X-Frame-Options','DENY')
    response.headers.setdefault('Referrer-Policy','strict-origin-when-cross-origin')
    response.headers.setdefault('Permissions-Policy','camera=(), microphone=(), geolocation=()')
    if request.url.path.startswith('/device/'):
        response.headers.setdefault('Cache-Control','no-store')
    return response

def sh(cmd, input=None):
    return subprocess.check_output(cmd, input=input, text=True).strip()

def session_value():
    return hmac.new(SESSION_SECRET, b'admin-session', hashlib.sha256).hexdigest()

def authed(req: Request):
    got = req.cookies.get('freevpn_admin', '')
    return hmac.compare_digest(got, session_value())

def csrf_value():
    return hmac.new(SESSION_SECRET, b'csrf', hashlib.sha256).hexdigest()

def check_csrf(value: str):
    if not hmac.compare_digest(value or '', csrf_value()):
        raise HTTPException(403, 'Invalid CSRF token')

def clean_name(name):
    n = re.sub(r'[^A-Za-z0-9_.-]+','-',name.strip())[:40].strip('-')
    if not n or n in ('.','..'): raise HTTPException(400,'Invalid device name')
    return n

def meta_files():
    out=[]
    for p in CLIENTS.glob('*.json'):
        try: out.append(json.loads(p.read_text()))
        except (json.JSONDecodeError, OSError, KeyError): pass
    return sorted(out,key=lambda x:x.get('created',0))

def used_ips(): return {x.get('ip') for x in meta_files()}

def next_ip():
    used=used_ips()
    # First usable host is reserved for the VPN server itself.
    for idx, h in enumerate(SUBNET.hosts()):
        if idx == 0: continue
        if str(h) not in used: return str(h)
    raise HTTPException(409,'VPN address pool is full')

def reload_wg():
    stripped = sh(['wg-quick','strip',str(WG)])
    proc = subprocess.run(['wg','syncconf','wg0','/dev/stdin'], input=stripped, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(f'WireGuard reload failed: {proc.stderr.strip()}')

def add_peer_to_conf(pub, ip, name):
    with WG.open('a') as f:
        f.write(f'\n# client:{name}\n[Peer]\nPublicKey = {pub}\nAllowedIPs = {ip}/32\n')
    try:
        reload_wg()
    except Exception:
        # Roll back the config edit if live reload fails.
        remove_peer_from_file(pub, name)
        raise

def remove_peer_from_file(pub, name):
    txt=WG.read_text()
    pattern=rf'\n# client:{re.escape(name)}\n\[Peer\]\nPublicKey = {re.escape(pub)}\nAllowedIPs = [^\n]+\n'
    WG.write_text(re.sub(pattern,'\n',txt))

def remove_peer(pub,name):
    original = WG.read_text()
    remove_peer_from_file(pub,name)
    try:
        reload_wg()
    except Exception:
        WG.write_text(original)
        raise

def client_conf(meta):
    server_pub=(DATA/'server_public.key').read_text().strip()
    return f'''[Interface]\nPrivateKey = {meta['private_key']}\nAddress = {meta['ip']}/32\nDNS = 1.1.1.1, 1.0.0.1\n\n[Peer]\nPublicKey = {server_pub}\nEndpoint = {ENDPOINT}:{PORT}\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25\n'''

def wg_status():
    try:
        lines=sh(['wg','show','wg0','dump']).splitlines()
        raw=lines[1:] if len(lines)>1 else []
        bypub={m['public_key']:m for m in meta_files() if 'public_key' in m}
        now=int(time.time()); st={}
        for r in raw:
            cols=r.split('\t')
            if len(cols) < 7: continue
            pub=cols[0]
            if pub in bypub:
                hs=int(cols[4] or 0); st[pub]={'last_handshake':hs,'online': hs>0 and now-hs<180,'rx':int(cols[5]),'tx':int(cols[6])}
        return st
    except Exception:
        return {}

@app.get('/healthz')
def healthz():
    return {'ok': True}

@app.get('/login',response_class=HTMLResponse)
def login_page(request:Request):
    return templates.TemplateResponse('login.html',{'request':request,'error':None,'csrf':csrf_value()})

@app.post('/login')
def login(request:Request, token:str=Form(...), csrf:str=Form(...)):
    check_csrf(csrf)
    if not hmac.compare_digest(token, TOKEN):
        time.sleep(0.35)
        return templates.TemplateResponse('login.html',{'request':request,'error':'管理密碼錯誤','csrf':csrf_value()},status_code=401)
    r=RedirectResponse('/',303)
    r.set_cookie('freevpn_admin',session_value(),httponly=True,samesite='strict',secure=COOKIE_SECURE,max_age=43200)
    return r

@app.get('/logout')
def logout():
    r=RedirectResponse('/login',303); r.delete_cookie('freevpn_admin'); return r

@app.get('/academic', response_class=HTMLResponse)
def academic_mode(request: Request):
    if not authed(request): return RedirectResponse('/login')
    return templates.TemplateResponse('academic.html',{
        'request':request,
        'nuu_vpn_url':NUU_VPN_URL,
        'nuu_help_url':NUU_HELP_URL,
        'nuu_library_url':NUU_LIBRARY_URL,
    })

@app.get('/openscite')
def openscite(request: Request):
    if not authed(request): return RedirectResponse('/login')
    if not OPENSCITE_FILE.exists(): raise HTTPException(503,'OpenScite bundle missing')
    return FileResponse(OPENSCITE_FILE, media_type='text/html', headers={'Cache-Control':'no-store'})

@app.get('/automation-extension')
def automation_extension(request: Request):
    if not authed(request): raise HTTPException(401)
    if not AUTOMATION_ZIP.exists(): raise HTTPException(404)
    return FileResponse(AUTOMATION_ZIP, media_type='application/zip',
        filename='openscite-browser-automation-v10.zip',
        headers={'Cache-Control':'no-store'})

@app.get('/',response_class=HTMLResponse)
def home(request:Request):
    if not authed(request): return RedirectResponse('/login')
    status=wg_status(); devices=[]
    for m in meta_files():
        s=status.get(m.get('public_key'),{}); devices.append({**m,**s})
    return templates.TemplateResponse('index.html',{'request':request,'devices':devices,'endpoint':ENDPOINT,'port':PORT,'csrf':csrf_value()})

@app.post('/devices')
def create_device(request:Request,name:str=Form(...),csrf:str=Form(...)):
    if not authed(request): raise HTTPException(401)
    check_csrf(csrf)
    name=clean_name(name); path=CLIENTS/f'{name}.json'
    if path.exists(): raise HTTPException(409,'Device already exists')
    priv=sh(['wg','genkey']); pub=sh(['wg','pubkey'],input=priv); ip=next_ip()
    meta={'name':name,'ip':ip,'private_key':priv,'public_key':pub,'created':int(time.time())}
    # Add peer first. Only persist the client file after WireGuard accepted the peer.
    add_peer_to_conf(pub,ip,name)
    try:
        path.write_text(json.dumps(meta)); os.chmod(path,0o600)
    except Exception:
        remove_peer(pub,name)
        raise
    return RedirectResponse(f'/device/{name}',303)

@app.get('/device/{name}',response_class=HTMLResponse)
def device(request:Request,name:str):
    if not authed(request): return RedirectResponse('/login')
    name=clean_name(name); p=CLIENTS/f'{name}.json'
    if not p.exists(): raise HTTPException(404)
    meta=json.loads(p.read_text())
    return templates.TemplateResponse('device.html',{'request':request,'device':meta,'config':client_conf(meta),'csrf':csrf_value()})

@app.get('/device/{name}/config')
def download_config(request:Request,name:str):
    if not authed(request): raise HTTPException(401)
    name=clean_name(name); p=CLIENTS/f'{name}.json'
    if not p.exists(): raise HTTPException(404)
    meta=json.loads(p.read_text())
    return PlainTextResponse(client_conf(meta),headers={'Content-Disposition':f'attachment; filename="{name}.conf"','Cache-Control':'no-store'})

@app.get('/device/{name}/qr')
def qr(request:Request,name:str):
    if not authed(request): raise HTTPException(401)
    name=clean_name(name); p=CLIENTS/f'{name}.json'
    if not p.exists(): raise HTTPException(404)
    img=qrcode.make(client_conf(json.loads(p.read_text()))); buf=io.BytesIO(); img.save(buf,format='PNG'); buf.seek(0)
    return StreamingResponse(buf,media_type='image/png',headers={'Cache-Control':'no-store'})

@app.post('/device/{name}/delete')
def delete_device(request:Request,name:str,csrf:str=Form(...)):
    if not authed(request): raise HTTPException(401)
    check_csrf(csrf)
    name=clean_name(name); p=CLIENTS/f'{name}.json'
    if p.exists():
        meta=json.loads(p.read_text()); remove_peer(meta['public_key'],name); p.unlink()
    return RedirectResponse('/',303)
