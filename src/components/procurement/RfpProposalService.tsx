/** Public, server-rendered explanation. The example is editorial fiction, not marketplace activity. */
export default function RfpProposalService() {
  return (
    <section id="supplier-proposals" className="ns-proposal-service" aria-labelledby="supplier-proposals-heading">
      <p className="ns-service-label">From your RFP to supplier discussions</p>
      <h2 id="supplier-proposals-heading">Bring your RFP. Publish your requirement. Choose who can respond.</h2>
      <p>Netify is a procurement service for SD-WAN and SASE projects. Bring an existing RFP, including one drafted with an AI assistant, or build a simple RFI or detailed RFP here. Review what will be shared, verify your work email and publish an anonymous opportunity.</p>
      <ol className="ns-service-steps">
        <li><strong>Bring or build your requirement.</strong> Paste your existing brief or import its text, then check the scope and supplier questions.</li>
        <li><strong>Approve anonymous publication.</strong> Your public listing excludes your name and contact details. Remove identifying details from the fuller requirement you authorise approved, signed-in suppliers to review.</li>
        <li><strong>Review requests to bid.</strong> Approved suppliers can review that requirement and ask to engage. Publication does not automatically invite every provider in Netify&apos;s research directory.</li>
        <li><strong>Choose your supplier discussions.</strong> Approve the requests you want to pursue. Approval opens a private conversation where you and that supplier can discuss its approach and proposals.</li>
      </ol>
      <p className="ns-service-limit">Free to publish, with no commitment to buy. Supplier participation, proposals and response times are not guaranteed. An RFI can ask for capabilities and indicative information; a detailed RFP can request a proposal against your selected questions.</p>
      <details className="ns-service-demo">
        <summary>See an illustrative supplier response journey</summary>
        <p><strong>Demonstration only.</strong> The requirement, supplier and messages below are fictional. This is not a live project, an actual supplier response or evidence that suppliers will participate.</p>
        <dl>
          <div><dt>Example requirement</dt><dd>A business needs managed SASE for its offices and remote users, with a phased move from its existing VPN.</dd></div>
          <div><dt>Fictional supplier request</dt><dd>We would like to discuss your migration and support requirements before preparing a proposal.</dd></div>
          <div><dt>Example buyer decision</dt><dd>The buyer approves this request to open a private conversation. Other requests can remain unapproved.</dd></div>
          <div><dt>Fictional supplier reply</dt><dd>We suggest a discovery stage and a pilot. Please confirm your locations, user numbers and identity platform so we can explain our proposed scope, assumptions and pricing.</dd></div>
        </dl>
        <p>No supplier names, prices, response counts or success rates in this demonstration describe real marketplace activity.</p>
      </details>
      <p><a href="#page-h1">Start with your requirement</a>.</p>
    </section>
  );
}
