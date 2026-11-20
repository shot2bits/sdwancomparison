/** Synthetic, self-contained fixtures. No customer, provider or downloaded source content. */
import {randomUUID} from 'node:crypto';
import {emptyCoreProject} from '../src/lib/core-buyer-tools';
import {CONTEXT_PRODUCTS} from '../src/lib/context-product-catalogue';
import {estateFixture} from './phase1b-fixtures';
export function finalEstateFixture(size:number){const base:any=emptyCoreProject(randomUUID());base.packet.project.input.service_model='fully_managed';base.packet.project.input.products=CONTEXT_PRODUCTS.map(p=>({id:p.id,included:['sdwan','sse','ztna'].includes(p.id),intent:'new',operation:'fully_managed',existing_product:'',features:p.features.slice(0,1).map(f=>f.id),custom_features:[]}));return estateFixture(base,size);}
