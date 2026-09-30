import { SOURCING_STEPS } from "@/lib/sourcing-contract";
export default function HowItWorksDiagram() {
 return <ol aria-label="Netify sourcing journey" className="grid md:grid-cols-4 gap-6 my-8">{SOURCING_STEPS.map((step,i)=><li key={step.title}><h3>{i+1}. {step.title}</h3><p>{step.body}</p></li>)}</ol>;
}
