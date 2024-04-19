import "@/styles/globals.css";
import Image from "next/image";
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
import { useRouter } from "next/router";

interface LayoutProps {
  children?: ReactNode;
}

interface NavbarItemProps {
  link: string
  label: string
  selected: string
}

const NavbarItem: FC<NavbarItemProps> = ({ link, label, selected }) => {
  return (
    <div className={"p-3" + (selected === link ? " menu-selected" : "")}>
      <Link href={link} legacyBehavior passHref>
        {label}
      </Link>
    </div>
  )
}

const Layout: NextPage<LayoutProps> = ({ children }) => {
  useIndexer();
  const { pathname: current, basePath } = useRouter();
  const paths = [
    { pathname: '/attestations', label: 'Attestations' },
    { pathname: '/schemas', label: 'Schemas' },
  ];

  return <div>
    <nav className="px-5 pt-5">
      <div className="p-5 flex flex-col-reverse sm:flex-row items-center justify-between">
        <div>
          <Image src={`${basePath}/images/aas-logo.png`} alt="Logo" width={70} height={70} />
        </div>
        <div className="flex flex-row items-center justify-between menu">
          {paths.map(({ pathname, label }) => (
            <NavbarItem
              key={pathname}
              link={pathname}
              label={label}
              selected={current} />
          ))}
        </div>
        <div className="mb-5 sm:mb-0">
          <ConnectKitButton />
        </div>
      </div>
    </nav>
    <main className="px-5 mx-auto max-w-7xl">
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


