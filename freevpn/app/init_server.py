import os, subprocess, pathlib, ipaddress

DATA = pathlib.Path('/data')
WG = DATA / 'wg0.conf'
PRIV = DATA / 'server_private.key'
PUB = DATA / 'server_public.key'
PORT = int(os.getenv('VPN_PORT','51820'))
SUBNET = ipaddress.ip_network(os.getenv('VPN_SUBNET','10.66.66.0/24'))
SERVER_IP = str(list(SUBNET.hosts())[0])

def sh(cmd, input=None):
    return subprocess.check_output(cmd, input=input, text=True).strip()

def ensure_keys():
    if not PRIV.exists():
        priv = sh(['wg','genkey'])
        pub = sh(['wg','pubkey'], input=priv)
        PRIV.write_text(priv+'\n')
        PUB.write_text(pub+'\n')
        os.chmod(PRIV,0o600)
    return PRIV.read_text().strip()

def build_base(priv):
    return f'''[Interface]\nAddress = {SERVER_IP}/{SUBNET.prefixlen}\nListenPort = {PORT}\nPrivateKey = {priv}\nPostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -s {SUBNET} -o eth0 -j MASQUERADE\nPostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -s {SUBNET} -o eth0 -j MASQUERADE\n'''

def main():
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA/'clients').mkdir(exist_ok=True)
    priv = ensure_keys()
    if not WG.exists(): WG.write_text(build_base(priv))
    try:
        subprocess.run(['wg-quick','down',str(WG)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception: pass
    subprocess.run(['wg-quick','up',str(WG)], check=False)

if __name__=='__main__': main()
