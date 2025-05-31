import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrum,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'RMSP Trading Interface',
  projectId: 'YOUR_PROJECT_ID', // Get from https://cloud.walletconnect.com
  chains: [arbitrum],
  ssr: true, // If your dApp uses server side rendering (SSR)
});