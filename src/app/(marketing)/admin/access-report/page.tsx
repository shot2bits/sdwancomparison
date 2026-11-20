import AccessReport from '@/components/AccessReport';
export const metadata = {title:'Access and sign-in outcomes',robots:{index:false,follow:false}};
export default function Page() {
  return <article className="mx-auto max-w-6xl px-6 py-12"><p className="eyebrow">Internal reporting</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Access and sign-in outcomes</h1><AccessReport /></article>;
}
