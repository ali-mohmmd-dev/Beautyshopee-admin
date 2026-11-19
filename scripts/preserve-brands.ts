import {PrismaClient} from '@prisma/client';
import {emptyRecord,emptyImage,emptySeo} from '../src/lib/model';
process.loadEnvFile('.env');const db=new PrismaClient();
async function main(){for(const [name,slug,image] of [['Rose Atelier','rose-atelier','cat-face'],['Velvet Muse','velvet-muse','cat-lips'],['Soft Focus Studio','soft-focus-studio','cat-eyes']]){const data={...emptyRecord('brands'),name,slug,sample:true,featured:true,logo:{...emptyImage,url:process.env.R2_PUBLIC_URL+'/imported/src/assets/'+image+'.jpg',alt:name},seo:{...emptySeo,title:name,description:'Browse '+name+' at Beauty Shoppee Tirur.'}};await db.content.upsert({where:{kind_slug:{kind:'brands',slug}},create:{kind:'brands',slug,title:name,draft:data,published:data,publishedAt:new Date()},update:{}});}console.log('Existing sample brand cards preserved in CMS records.');}main().finally(()=>db.$disconnect());

