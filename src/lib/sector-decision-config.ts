import {sectorFor,type ComparisonSector,type ChallengeId} from './sector-comparison-config';
export const DECISION_WORKSPACE_VERSION='sector-decision-room/2026-11-10.2';
export const SCENARIO_CHECKS={
 "failover": {
  "label": "High-availability capability",
  "codes": [
   "high_availability"
  ]
 },
 "paths": {
  "label": "Dynamic path selection",
  "codes": [
   "dynamic_path_selection"
  ]
 },
 "apps": {
  "label": "Application-aware routing",
  "codes": [
   "application_aware_routing"
  ]
 },
 "logs": {
  "label": "Raw log access",
  "codes": [
   "raw_log_access"
  ]
 },
 "dem": {
  "label": "Application and user diagnostics",
  "codes": [
   "digital_experience_monitoring",
   "digital_experience_diagnostics"
  ]
 },
 "sla": {
  "label": "SLA reporting",
  "codes": [
   "sla_reporting"
  ]
 },
 "migration": {
  "label": "Brownfield migration capability",
  "codes": [
   "brownfield_migration_support"
  ]
 },
 "segmentation": {
  "label": "Network segmentation",
  "codes": [
   "segmentation_vrf_capability"
  ]
 },
 "ztna": {
  "label": "Zero trust access",
  "codes": [
   "ztna"
  ]
 },
 "privileged": {
  "label": "Privileged access",
  "codes": [
   "privileged_access"
  ]
 },
 "clientless": {
  "label": "Clientless access",
  "codes": [
   "clientless_access"
  ]
 },
 "byod": {
  "label": "Unmanaged-device access",
  "codes": [
   "unmanaged_byod_devices"
  ]
 },
 "cellular": {
  "label": "Cellular connectivity",
  "codes": [
   "cap_5g_lte_support"
  ]
 },
 "satellite": {
  "label": "Satellite connectivity",
  "codes": [
   "leo_satellite_support"
  ]
 },
 "qos": {
  "label": "Traffic prioritisation",
  "codes": [
   "qos_and_traffic_engineering"
  ]
 },
 "underlay": {
  "label": "Supported WAN underlays",
  "codes": [
   "supported_wan_underlays"
  ]
 },
 "rollout": {
  "label": "Zero-touch provisioning",
  "codes": [
   "zero_touch_provisioning"
  ]
 },
 "web": {
  "label": "Web filtering capability",
  "codes": [
   "secure_web_gateway"
  ]
 },
 "dlp": {
  "label": "Data loss prevention",
  "codes": [
   "data_loss_prevention"
  ]
 },
 "ai": {
  "label": "AI application data controls",
  "codes": [
   "ai_data_protection_controls"
  ]
 },
 "lan": {
  "label": "Branch LAN and Wi-Fi integration",
  "codes": [
   "branch_lan_wlan_integration"
  ]
 }
} as const;
export type ScenarioCheckId=keyof typeof SCENARIO_CHECKS;
export type SectorPriority={id:string;title:string;description:string;challenges:ChallengeId[];checks:ScenarioCheckId[];test:string};
export const SECTOR_PRIORITIES:Record<ComparisonSector,SectorPriority[]>={
 "financial_services": [
  {
   "id": "critical-services",
   "title": "Prove recovery for a named business service",
   "description": "Which payment, trading, claims or customer-service application has a disruption tolerance we need to test?",
   "challenges": [
    "resilience",
    "audit"
   ],
   "checks": [
    "failover",
    "paths",
    "logs"
   ],
   "test": "Agree the named application, its dependencies and the buyer's disruption tolerance. Test circuit, edge and SASE-service failure separately, recording recovery, application behaviour and the incident evidence. Product availability figures alone do not prove recovery of the business service."
  },
  {
   "id": "accountability",
   "title": "Resolve incidents across multiple suppliers",
   "description": "If the circuit, SD-WAN platform and security service have different suppliers, who must own diagnosis and restoration?",
   "challenges": [
    "ownership",
    "visibility"
   ],
   "checks": [
    "dem",
    "sla",
    "logs"
   ],
   "test": "Walk through a failure spanning circuit, platform and security provider. Require one named incident owner, escalation contacts, measurement points, update times and an exportable incident record. Confirm which commitments appear in each contract."
  },
  {
   "id": "exit",
   "title": "Retain policies and evidence when you leave",
   "description": "Which configurations, logs, policies, circuits and platform access must you retain when replacing the managed provider?",
   "challenges": [
    "exit",
    "migration"
   ],
   "checks": [
    "logs",
    "migration"
   ],
   "test": "Request sample configuration and log exports, retention terms and a priced exit schedule. Confirm licence ownership, transition access, dependencies on the incumbent and a tested cutover and rollback plan. An export feature alone does not prove contractual portability."
  }
 ],
 "government_public_sector": [
  {
   "id": "partner-access",
   "title": "Give partner agencies access to specific services",
   "description": "Do contractors or partner agencies use devices you do not manage, and which services must they be unable to reach?",
   "challenges": [
    "remote",
    "segmentation"
   ],
   "checks": [
    "ztna",
    "byod",
    "clientless"
   ],
   "test": "Use a representative partner identity and unmanaged device to test access to an approved application and denial of access to other services. Demonstrate approval, revocation and audit export. Confirm the actual identity federation, licences and delivery partner."
  },
  {
   "id": "data-handling",
   "title": "Locate inspection, logs and support access",
   "description": "Where may traffic inspection, logs, backups and support access take place, and who can authorise an exception?",
   "challenges": [
    "residency",
    "audit"
   ],
   "checks": [
    "logs"
   ],
   "test": "Require a service-specific data-flow map covering inspection, logs, backups, administrators and subcontractors. Check each required country and access restriction against contractual commitments. A local point of presence does not prove that all data or support access stays there."
  },
  {
   "id": "service-ownership",
   "title": "Separate the platform contract from delivery",
   "description": "Are you buying a platform, managed operations or a migration partner, and what procurement route or incumbent contracts constrain the choice?",
   "challenges": [
    "ownership",
    "migration"
   ],
   "checks": [
    "migration",
    "sla"
   ],
   "test": "Require separate platform, migration and operating scopes with named delivery parties and retained buyer tasks. Confirm the applicable procurement route and current service listing separately, then walk through cutover, an incident and a change request across the contracts."
  }
 ],
 "retail_ecommerce": [
  {
   "id": "payments",
   "title": "Test payment transactions on cellular backup",
   "description": "When a store switches to backup connectivity, must payment terminals retain the same segmentation and inspection policy?",
   "challenges": [
    "cellular",
    "resilience",
    "segmentation"
   ],
   "checks": [
    "cellular",
    "segmentation",
    "apps"
   ],
   "test": "Run representative payment transactions during fixed-line failure and recovery. Record interrupted sessions, authorisation times, usable backup capacity, payment-provider restrictions and policy enforcement. Confirm coverage, data allowances and the exact proposed licence; cellular support alone is not proof."
  },
  {
   "id": "store-opening",
   "title": "Open stores before the fixed circuit arrives",
   "description": "How many stores must open or migrate each week, who installs the equipment, and what happens when a circuit is late?",
   "challenges": [
    "rollout",
    "migration"
   ],
   "checks": [
    "rollout",
    "cellular",
    "migration"
   ],
   "test": "Require a weekly deployment schedule, named installer capacity, temporary access and dependencies for late circuits. Test a zero-touch installation, a failed installation, application acceptance and rollback. Agree who resolves on-site failures and the charges for revisits."
  },
  {
   "id": "store-separation",
   "title": "Keep payment, guest and store systems apart",
   "description": "Which payment, guest, CCTV, stock and staff systems must remain separated during failover and remote support?",
   "challenges": [
    "segmentation",
    "audit"
   ],
   "checks": [
    "segmentation",
    "logs"
   ],
   "test": "Map permitted flows between payment, guest, CCTV, stock and staff systems. Test denied paths, remote administration and backup connectivity, then request policy-change evidence. A VLAN or VRF feature does not establish effective PCI scope reduction or buyer compliance."
  }
 ],
 "healthcare": [
  {
   "id": "clinical",
   "title": "Test clinical access before changing traffic paths",
   "description": "Which clinical applications or devices cannot accept an endpoint agent, traffic interception or a changed network path?",
   "challenges": [
    "resilience",
    "routing"
   ],
   "checks": [
    "underlay",
    "apps",
    "migration"
   ],
   "test": "Name the applications and devices, protocol dependencies and agent or interception exceptions. Validate the proposed traffic paths with the buyer's clinical and technical owners, then test cutover, link failure and rollback in an approved change window. Generic SASE support is not clinical validation."
  },
  {
   "id": "devices",
   "title": "Define the permitted flows around medical devices",
   "description": "Which imaging, pathology or other medical systems need to communicate across device, staff and visitor network boundaries?",
   "challenges": [
    "segmentation",
    "visibility"
   ],
   "checks": [
    "segmentation",
    "logs",
    "dem"
   ],
   "test": "Map required medical-device and clinical application flows before changing boundaries. Demonstrate permitted and denied paths using representative systems and buyer-approved tests. Confirm legacy protocol constraints, monitoring visibility and ownership of exceptions; a segmentation feature alone is insufficient."
  },
  {
   "id": "clinical-access",
   "title": "Limit supplier and temporary clinical access",
   "description": "Who needs temporary access to clinical systems, from which devices, and must each session be approved, restricted or recorded?",
   "challenges": [
    "remote",
    "audit"
   ],
   "checks": [
    "ztna",
    "clientless",
    "privileged"
   ],
   "test": "Test a representative clinician or maintenance supplier reaching only an approved system from the required device type. Demonstrate approval, expiry, revocation and available session or audit records. Confirm whether the proposed product supports the exact protocol and recording requirement without an agent."
  }
 ],
 "manufacturing": [
  {
   "id": "production",
   "title": "Keep plant functions local during a cloud outage",
   "description": "Which production networks must keep operating if internet access, cloud policy control or the SASE service is unavailable?",
   "challenges": [
    "resilience",
    "migration"
   ],
   "checks": [
    "failover",
    "segmentation",
    "underlay"
   ],
   "test": "Identify which plant functions and policy decisions must remain local. In an approved non-disruptive test, isolate internet or cloud control and demonstrate the required local operation, dependencies, safe recovery and rollback. Do not assume a cloud-managed product can operate every production workload independently."
  },
  {
   "id": "maintenance",
   "title": "Restrict machine suppliers to individual assets",
   "description": "Do machine suppliers need approved, time-limited access without installing agents on controllers, and must sessions be recorded?",
   "challenges": [
    "remote",
    "segmentation"
   ],
   "checks": [
    "ztna",
    "privileged",
    "clientless"
   ],
   "test": "Confirm whether OT is in scope and name the assets and protocols. Test approved, time-limited maintenance access to one asset, denial of wider access, revocation and required records without changing controller software. Generic ZTNA does not establish OT protocol compatibility or safe operation."
  },
  {
   "id": "plants",
   "title": "Decide which plants still need private connectivity",
   "description": "Which plant applications or locations justify retaining private connectivity, and what latency, loss or application behaviour would rule out internet-only service?",
   "challenges": [
    "routing",
    "migration"
   ],
   "checks": [
    "underlay",
    "apps",
    "qos"
   ],
   "test": "Compare representative plant-to-application paths and proposed underlays using the buyer's latency, loss and application criteria. Include relevant international routes, coexistence costs, change windows and rollback. Do not treat a nearby point of presence or generic backbone claim as measured plant performance."
  }
 ],
 "energy_utilities": [
  {
   "id": "remote-sites",
   "title": "Size backup links for remote assets",
   "description": "Which remote sites depend on cellular or satellite, and what traffic must survive limited bandwidth or lost cloud connectivity?",
   "challenges": [
    "cellular",
    "resilience"
   ],
   "checks": [
    "cellular",
    "satellite",
    "qos"
   ],
   "test": "For each representative remote-site type, confirm the required access technology, survey results, usable capacity and data limits. Test critical flows under the agreed bandwidth and failure conditions. Cellular and satellite are alternatives to investigate, not automatically joint requirements."
  },
  {
   "id": "contractors",
   "title": "Confine maintenance access to one operational asset",
   "description": "Can a contractor reach one approved asset without opening a route into the wider control network?",
   "challenges": [
    "remote",
    "segmentation"
   ],
   "checks": [
    "ztna",
    "privileged",
    "segmentation"
   ],
   "test": "Where operational systems are in scope, test approved contractor access to the named asset and protocol, denied lateral movement, session expiry and audit evidence. Confirm emergency-access procedures and local ownership. General remote-access support does not prove safe control-system integration."
  },
  {
   "id": "operations",
   "title": "Check what still operates without central control",
   "description": "Which routing and security functions must remain local when central control is unavailable, and how can that be tested safely?",
   "challenges": [
    "ownership",
    "resilience"
   ],
   "checks": [
    "failover",
    "underlay",
    "logs"
   ],
   "test": "Agree local routing, policy and operational dependencies with the asset owner. Use an approved safe test to show behaviour during control-plane loss, recovery and policy reconciliation. Require a named incident owner and distinguish platform evidence from site-specific operational approval."
  }
 ],
 "education": [
  {
   "id": "campus",
   "title": "Choose controls for your type of education estate",
   "description": "Is this a school, college, university or research network, and which safeguarding, filtering or research-access requirements actually apply?",
   "challenges": [
    "routing",
    "segmentation"
   ],
   "checks": [
    "web",
    "segmentation",
    "qos"
   ],
   "test": "Confirm the institution type and applicable requirements before comparing products. Demonstrate the required user-group policies, legitimate learning or research access and peak-demand behaviour. School safeguarding requirements must not be applied automatically to a university or research network."
  },
  {
   "id": "access",
   "title": "Follow managed devices beyond the campus",
   "description": "Must filtering and monitoring follow managed devices off site, and who receives, reviews and acts on alerts?",
   "challenges": [
    "remote",
    "audit"
   ],
   "checks": [
    "web",
    "logs",
    "byod"
   ],
   "test": "Test required filtering on and off campus, identifying device and browser coverage and known exclusions. Demonstrate alert export and escalation to the named responsible team. Web filtering alone is not a complete safeguarding or human monitoring service."
  },
  {
   "id": "visibility",
   "title": "Separate student, guest and operational access",
   "description": "Which student, guest, research and operational devices need different access, and what happens when identity services fail?",
   "challenges": [
    "segmentation",
    "visibility"
   ],
   "checks": [
    "segmentation",
    "byod",
    "dem"
   ],
   "test": "Test representative device and user groups against permitted services, including unmanaged devices and an agreed authentication-failure scenario. Show the evidence available to the service desk and the owner of access exceptions. Confirm applicability separately for each campus or institution type."
  }
 ],
 "transport_logistics": [
  {
   "id": "depots",
   "title": "Write an SLA around the application and path",
   "description": "Does the SLA cover a circuit, the overlay or a dispatch or warehouse application, and from which measurement points?",
   "challenges": [
    "routing",
    "visibility"
   ],
   "checks": [
    "sla",
    "dem",
    "apps"
   ],
   "test": "Draft separate availability, latency, loss and restoration measures for the agreed application paths. Require measurement points, sampling, exclusions, escalation, reporting and remedies. Agree target values with the buyer and supplier; a platform availability SLA is not an end-to-end application commitment."
  },
  {
   "id": "rollout",
   "title": "Connect depots with different delivery constraints",
   "description": "Which depots need temporary connectivity, cellular backup or partner access, and what coverage or addressing constraints apply?",
   "challenges": [
    "rollout",
    "cellular"
   ],
   "checks": [
    "cellular",
    "rollout",
    "migration"
   ],
   "test": "Require a depot-by-depot plan covering addressing, partner dependencies, circuit lead times and surveyed backup access. Test a representative late-circuit installation, application acceptance and rollback. Confirm installer capacity and responsibilities rather than inferring them from zero-touch provisioning."
  },
  {
   "id": "partners",
   "title": "Assign restoration when dispatch or scanning fails",
   "description": "When packet loss or failover interrupts dispatch, scanning or partner access, who investigates and what evidence proves restoration?",
   "challenges": [
    "ownership",
    "visibility"
   ],
   "checks": [
    "dem",
    "sla",
    "logs"
   ],
   "test": "Walk through an impaired-link incident affecting the named operational workflow. Capture application and network measurements, escalation across suppliers, restoration evidence and any partner-access boundary. Do not assume safety-critical transport systems are in scope from the sector label."
  }
 ],
 "professional_services": [
  {
   "id": "hybrid",
   "title": "Control client data in cloud and AI applications",
   "description": "Which client documents must not reach personal storage or unapproved AI services, and through which applications?",
   "challenges": [
    "remote",
    "audit"
   ],
   "checks": [
    "dlp",
    "ai",
    "logs"
   ],
   "test": "Name the applications, upload channels and client-data categories. Test allowed and blocked transfers, exceptions, user notifications and audit records using non-sensitive sample data. Confirm the proposed DLP and AI-control licences; a general feature claim does not prove control of every channel."
  },
  {
   "id": "cloud",
   "title": "Restrict access from unmanaged partner devices",
   "description": "Do partners or contractors need application access with limits on downloading, copying or printing?",
   "challenges": [
    "remote",
    "segmentation"
   ],
   "checks": [
    "clientless",
    "byod",
    "ztna"
   ],
   "test": "Test the named application from a representative unmanaged device. Demonstrate the requested download, copy and print controls, identity checks and revocation. Verify browser, protocol, product and licence limitations rather than treating clientless access as a complete data-control answer."
  },
  {
   "id": "manageability",
   "title": "Diagnose slow cloud applications across suppliers",
   "description": "What evidence must your team see to separate device, ISP, security policy and application causes of slow Microsoft 365, VDI or client-hosted services?",
   "challenges": [
    "visibility",
    "ownership"
   ],
   "checks": [
    "dem",
    "apps",
    "logs"
   ],
   "test": "Use a representative remote-user and application fault to demonstrate diagnostic visibility and exportable evidence. Confirm which team owns each layer and the escalation hand-off, including any monitoring licence. Generalise only to the applications and device types actually tested."
  }
 ],
 "hospitality_leisure": [
  {
   "id": "guests",
   "title": "Separate guest, payment and property systems",
   "description": "How must guest Wi-Fi, payment, staff and building systems remain separated across owned and franchised venues?",
   "challenges": [
    "segmentation",
    "audit"
   ],
   "checks": [
    "segmentation",
    "lan",
    "logs"
   ],
   "test": "Map guest, payment, staff and building-system flows for owned and franchised venue types. Test denied paths, permitted management and consistent policies during backup operation. Confirm who can change each boundary and retain the policy-change record."
  },
  {
   "id": "continuity",
   "title": "Test ordering and booking on backup connectivity",
   "description": "Which payment, property-management, ordering and booking services must work when a venue changes to backup connectivity?",
   "challenges": [
    "resilience",
    "cellular"
   ],
   "checks": [
    "cellular",
    "apps",
    "failover"
   ],
   "test": "Run representative payment, booking and ordering workflows through primary-link failure and recovery. Confirm site coverage, bandwidth, session behaviour, dependencies and actual PMS or payment integrations. General WAN connectivity does not prove application compatibility."
  },
  {
   "id": "properties",
   "title": "Support venues without local IT staff",
   "description": "Who replaces equipment and applies approved changes outside office hours when a venue has no IT staff on site?",
   "challenges": [
    "rollout",
    "ownership"
   ],
   "checks": [
    "rollout",
    "migration",
    "sla"
   ],
   "test": "Require a venue-type rollout and support plan with operating hours, named field-service coverage, spare equipment, change approval and restoration commitments. Walk through an out-of-hours equipment failure and a failed change, including rollback and charges."
  }
 ]
};
export const DESIGN_APPROACHES=[
 {id:'managed',title:'Managed network and security',description:'Compare one accountable service boundary, the actual platform and retained buyer responsibilities.',proof:'A named responsibility matrix, ordered platform and licences, incident walkthrough, SOC inclusions or exclusions, and an acceptance test.'},
 {id:'retain',title:'Keep the network. Add secure access.',description:'Preserve useful network investment while examining identity, traffic paths and integration.',proof:'A traffic-flow design, supported integration versions, responsibility across products, and a migration and rollback plan.'},
 {id:'separate',title:'Choose the platform and operating partner separately',description:'Compare the technology and the team delivering it, including the hand-offs between them.',proof:'Separate platform and service scopes, one escalation plan, integration acceptance and transition responsibilities.'},
] as const;
export function priorityFor(sector:ComparisonSector,id?:string){return SECTOR_PRIORITIES[sector].find(p=>p.id===id);}
export function decisionTitle(sector:ComparisonSector){return sectorFor(sector)!.name+' decision room';}
export function architectureQuestions(approach:string,estate:string,model:string){
 const questions=[DESIGN_APPROACHES.find(d=>d.id===approach)?.proof??'Compare the alternative approaches and confirm the proposed service boundaries.'];
 if(model==='fully_managed'&&approach!=='managed'&&approach!=='undecided')questions.push('You want a fully managed outcome across separate components. Identify one operational owner across all hand-offs.');
 if(estate==='retain'&&approach==='managed')questions.push('You want to retain existing network investment. Confirm whether the proposed service can operate it or requires replacement.');
 if(model==='self_managed')questions.push('Confirm the staffing, policy ownership, operational tools, training and escalation retained by your team.');
 return questions;
}
