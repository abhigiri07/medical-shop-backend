const crypto = require('crypto');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mediquick.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const sessions = new Set();
function login(email,password){if(email!==ADMIN_EMAIL||password!==ADMIN_PASSWORD)return null;const token=crypto.randomBytes(32).toString('hex');sessions.add(token);return token}
function auth(req,res,next){const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';if(!sessions.has(token))return res.status(401).json({error:'Admin authentication required'});next()}
module.exports={login,auth,ADMIN_EMAIL};
