import { releaseVersion } from "@/lib/build-info";
export default function ReleaseVersion() {
  return <span data-release-version={releaseVersion()} title="Release date and time in the UK (DDMMYYHHmm)" style={{fontSize:12,color:"#596579",whiteSpace:"nowrap",fontWeight:400}}>Version {releaseVersion()}</span>;
}
