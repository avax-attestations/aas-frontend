import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Web3Provider } from "@/providers/web3-provider";
import { NextPage } from "next";
import React, { FC, ReactNode } from "react";
import Link from "next/link";
import { ConnectKitButton } from 'connectkit';
import { useIndexer } from "@/hooks/useIndexer";
import {
  Card
} from "@/components/card"
import { Toaster } from "@/components/ui/toaster";

interface LayoutProps {
  children?: ReactNode;
}

interface NavbarItemProps {
  link: string
  label: string
}

const NavbarItem: FC<NavbarItemProps> = ({ link, label }) => {
  return (
    <div className="link mr-10">
      <Link href={link} legacyBehavior passHref>
        {label}
      </Link>
    </div>
  )
}

const Layout: NextPage<LayoutProps> = ({ children }) => {
  useIndexer();

  return <div className="p-6">
    <nav>
      <Card className="p-6 flex items-center justify-between">
        <div className="flex flex-row items-center justify-between">
          <NavbarItem link="/" label="Home" />
          <NavbarItem link="/attestations" label="Attestations" />
          <NavbarItem link="/schemas" label="Schemas" />
        </div>
        <ConnectKitButton />
      </Card>
    </nav>
    <main>
      <div className="mt-6">
        {children}
      </div>
    </main>
    <Toaster />
  </div>
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Web3Provider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </Web3Provider>
  );
}
