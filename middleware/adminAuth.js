const crypto=require('crypto');
const ADMIN_EMAIL=process.env.ADMIN_EMAIL||'admin@saikrupa.local';
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'admin123';
const SECRET=process.env.ADMIN_SECRET||'change-this-secret-in-render';
function sign(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');return `${body}.${sig}`}
function verify(token){if(!token)return null;const [body,sig]=token.split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString());if(p.exp<Date.now())return null;return p}
function login(req,res){const {email,password}=req.body;if(email!==ADMIN_EMAIL||password!==ADMIN_PASSWORD)return res.status(401).json({error:'Invalid email or password'});res.json({token:sign({role:'admin',exp:Date.now()+8*60*60*1000})})}
function auth(req,res,next){const p=verify((req.headers.authorization||'').replace(/^Bearer\s+/i,''));if(!p||p.role!=='admin')return res.status(401).json({error:'Unauthorized'});next()}
module.exports={login,auth};
