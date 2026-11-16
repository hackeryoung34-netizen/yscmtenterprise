const {confirmPaidOrder,validWebhookSignature}=require("./_lib/paystack");
function send(res,status,body){res.status(status).setHeader("Content-Type","application/json; charset=utf-8").send(JSON.stringify(body));}
async function rawBody(req){if(Buffer.isBuffer(req.body))return req.body;if(typeof req.body==="string")return Buffer.from(req.body);const chunks=[];for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));return Buffer.concat(chunks);}
module.exports=async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Method not allowed"});}
  if(!process.env.PAYSTACK_SECRET_KEY||!process.env.SUPABASE_SERVICE_ROLE_KEY)return send(res,503,{error:"Webhook is not configured."});
  try{
    const raw=await rawBody(req);
    if(!validWebhookSignature(raw,req.headers))return send(res,401,{error:"Invalid Paystack signature."});
    const event=JSON.parse(raw.toString("utf8"));
    if(event.event!=="charge.success")return send(res,200,{received:true,ignored:true});
    const reference=event.data&&event.data.reference;
    if(typeof reference!=="string"||!/^yscmt-[0-9a-f-]{36}$/i.test(reference))return send(res,200,{received:true,ignored:true});
    await confirmPaidOrder(reference);
    return send(res,200,{received:true});
  }catch(e){return send(res,500,{error:e.message||"Webhook processing failed. Paystack may retry."});}
};
module.exports.config={api:{bodyParser:false}};
