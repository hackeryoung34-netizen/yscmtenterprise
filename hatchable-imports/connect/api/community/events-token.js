import { events } from "hatchable";

export const access = "user";
export const methods = ["GET"];

export default async function(req,res){
 const uid=String(req.user.id);
 return res.json(await events.grant(["user:"+uid,"community"]));
}