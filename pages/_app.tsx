import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Web3Provider } from '../components/ui/web3-provider';
import { NextPage } from "next";
import React, { FC, ReactNode } from "react";
import Link from "next/link";
import { ConnectKitButton } from 'connectkit';
import { useIndexer } from "@/hooks/useIndexer";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

import {
  Card, CardContent
} from "@/components/ui/card"
import { Toaster } from "@/components/ui/toaster";

interface LayoutProps {
  children?: ReactNode;
}

interface NavbarItemProps {
  link: string
  label: string
}

const NavbarItem: FC<NavbarItemProps> = ({ link, label }) => {
  return (<NavigationMenuItem>
    <Link href={link} legacyBehavior passHref>
      <NavigationMenuLink className={navigationMenuTriggerStyle()}>
        {label}
      </NavigationMenuLink>
    </Link>
  </NavigationMenuItem>)
}

const Layout: NextPage<LayoutProps> = ({ children }) => {
  useIndexer();

  return <>
    <nav>
      <Card className="max-w-5xl mx-auto mt-1">
        <CardContent className="p-6 mx-auto flex items-center justify-between">
          <NavigationMenu>
            <NavigationMenuList>
              <NavbarItem link="/" label="Home" />
              <NavbarItem link="/attestations" label="Attestations" />
              <NavbarItem link="/schemas" label="Schemas" />
            </NavigationMenuList>
          </NavigationMenu>
          <ConnectKitButton />
        </CardContent>
      </Card>
    </nav>
    <main>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        {children}
      </div>
    </main>
    <Toaster />
  </>
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
