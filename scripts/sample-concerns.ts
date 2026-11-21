import fs from "node:fs";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { emptyRecord, emptySeo, defaultConcernSection } from "../src/lib/model";
process.loadEnvFile(".env");
const origin=process.env.TEST_CMS_URL ?? "http://localhost:3001";
const store=process.env.TEST_STOREFRONT_URL ?? "http://localhost:3002";
const url=new URL(process.env.DATABASE_URL!);url.searchParams.set("connection_limit","1");
const db=new PrismaClient({datasourceUrl:url.toString()});
const samples=[
 {slug:"sample-lip-care",name:"Lip care",image:"silk-lip-oil",products:["silk-lip-oil","berry-glaze-lip-tint"],description:"Explore lip oils and tints for your daily beauty routine."},
 {slug:"sample-fresh-glow",name:"Fresh glow",image:"blush-collection",products:["blush-collection","rose-cloud-blush"],description:"Discover blush favourites for a fresh-looking makeup finish."},
 {slug:"sample-eye-definition",name:"Eye definition",image:"soft-definition-mascara",products:["soft-definition-mascara"],description:"Explore makeup for defining your eye look."},
 {slug:"sample-everyday-makeup",name:"Everyday makeup",image:"everyday-trio",products:["everyday-trio","must-haves"],description:"Build an easy everyday look with beauty essentials."},
 {slug:"sample-complete-routine",name:"Complete routine",image:"essentials-kit",products:["essentials-kit","everyday-trio"],description:"Explore coordinated sets for a complete makeup routine."},
];
try{
 const password=fs.readFileSync(".local-admin.txt","utf8").match(/Password: (.+)/)![1];
 const login=await fetch(origin+"/api/login",{method:"POST",headers:{Origin:origin},body:new URLSearchParams({password}),redirect:"manual",signal:AbortSignal.timeout(45000)});
 const cookie=login.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");assert.ok(cookie.includes("cms-session="),"CMS login failed");
 async function save(kind:string,record:any,data:any,action:string="publish"){
  const response=await fetch(origin+"/api/content",{method:"POST",headers:{Cookie:cookie,Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({kind,id:record?.id??null,version:record?.version??0,data,action}),signal:AbortSignal.timeout(45000)});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.ok(!result.warning,result.warning);return {...record,...result,draft:data};
 }
 const products=await db.content.findMany({where:{kind:"products",archivedAt:null}});
 const concerns: { id: string }[]=[];
 for(const sample of samples){
  const product=products.find(p=>p.slug===sample.image);assert.ok(product?.published,"Missing published sample image product");
  const published=product.published as Record<string,any>;
  const concernMedia=await db.media.findFirst({where:{filename:"concern-"+sample.slug.replace("sample-","")+".webp"},orderBy:{createdAt:"desc"}});
  const concernImage=concernMedia ? {url:concernMedia.url,alt:concernMedia.alt,caption:concernMedia.caption,imageText:concernMedia.imageText,decorative:concernMedia.decorative} : published.images[0];
  const existing=await db.content.findUnique({where:{kind_slug:{kind:"concerns",slug:sample.slug}}});
  const data={...emptyRecord("concerns"),name:sample.name,slug:sample.slug,description:"Sample collection for layout preview. Product assignments are illustrative.\n\n"+sample.description,image:concernImage,enabled:true,seo:{...emptySeo,title:sample.name+" — Sample collection",description:sample.description,noIndex:true}};
  concerns.push(await save("concerns",existing,data));
 }
 let assignments=0;
 for(const product of products){
  const ids=samples.flatMap((sample,index)=>sample.products.includes(product.slug)?[concerns[index].id]:[]);if(!ids.length||!product.published)continue;
  const published=product.published as Record<string,any>,draft=product.draft as Record<string,any>;
  const concernIds=[...new Set([...(published.concernIds??[]),...ids])];
  if(JSON.stringify(concernIds)!==JSON.stringify(published.concernIds??[])){
   const saved=await save("products",product,{...published,concernIds});
   if(JSON.stringify(draft)!==JSON.stringify(published))await save("products",saved,{...draft,concernIds:[...new Set([...(draft.concernIds??[]),...ids])]},"save");
  }
  assignments+=ids.length;
 }
 const settings=await db.content.findUniqueOrThrow({where:{kind_slug:{kind:"settings",slug:"site"}}});
 const published=(settings.published??settings.draft) as Record<string,any>;
 const draft=settings.draft as Record<string,any>;
 const previous=published.concernSection??defaultConcernSection;
 const concernIds=[...new Set([...(previous.concernIds??[]),...concerns.map(c=>c.id)])];
 const concernSection={...defaultConcernSection,...previous,enabled:true,concernIds,text:published.concernSection?.text??"Explore sample collections for your beauty routine."};
 const saved=await save("settings",settings,{...published,concernSection});
 if(JSON.stringify(draft)!==JSON.stringify(published))await save("settings",saved,{...draft,concernSection:{...concernSection,...draft.concernSection,enabled:true,concernIds}},"save");
 const home=await fetch(store,{signal:AbortSignal.timeout(45000)}).then(r=>r.text());assert.ok(home.includes('id="shop-by-concern"'));for(const sample of samples)assert.ok(home.includes('href="/concerns/'+sample.slug+'"'));
 const page=await fetch(store+"/concerns/"+samples[0]!.slug,{headers:{"User-Agent":"Googlebot"},signal:AbortSignal.timeout(45000)});assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('href="/products/silk-lip-oil"'));assert.ok(html.includes("noindex"));
 console.log(JSON.stringify({sampleConcerns:concerns.length,productAssignments:assignments,homepage:"visible",samplePages:"noindex",previewUrl:store+"/#shop-by-concern"}));
}finally{await db.$disconnect();}
