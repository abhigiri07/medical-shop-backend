const express=require('express');
const router=express.Router();
const {db}=require('../db');
const {auth}=require('../middleware/adminAuth');
router.use(auth);
router.get('/stats',(req,res)=>{const out={};db.serialize(()=>{db.get('SELECT COUNT(*) count FROM medicines',(e,r)=>{if(e)return res.status(500).json({error:e.message});out.medicines=r.count;db.get('SELECT COUNT(*) count FROM orders',(e2,r2)=>{if(e2)return res.status(500).json({error:e2.message});out.orders=r2.count;db.get("SELECT COUNT(*) count FROM orders WHERE status='PLACED'",(e3,r3)=>{if(e3)return res.status(500).json({error:e3.message});out.placed_orders=r3.count;db.get('SELECT COUNT(*) count FROM medicines WHERE stock_quantity>0 AND stock_quantity<=10',(e4,r4)=>{if(e4)return res.status(500).json({error:e4.message});out.low_stock=r4.count;res.json(out)})})})})})});
module.exports=router;
