import {
  getDeploymentMode,
  isLocalMode,
  isSaasMode,
  type DeploymentMode,
} from "@/lib/deploymentMode";

export { getDeploymentMode, isLocalMode, isSaasMode, type DeploymentMode };

export function saasDeploymentRequired(): boolean {
  return isSaasMode();
}
