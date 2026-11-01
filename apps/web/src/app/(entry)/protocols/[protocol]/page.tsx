import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { ProtocolScreen } from 'compositions/screens/protocol/server';
import { getProtocol } from 'domains/reference/server';
import { protocolPath } from 'domains/reference';
import { routeMetadata } from '../../../helpers/route-metadata';
import { englishProtocolParams } from '../../../helpers/route-params';
import type { EnglishProtocolPageProps } from '../../../types/route-props.type';

export const dynamicParams = false;
export const generateStaticParams = englishProtocolParams;

/**
 * Формирует канонические метаданные английского профиля.
 */
export async function generateMetadata({
  params,
}: EnglishProtocolPageProps): Promise<Metadata> {
  const { protocol } = await params;
  return routeMetadata(
    getProtocol(protocol, 'en').profile.title,
    protocolPath('en', protocol),
    'en',
  );
}

/**
 * Подключает обзор к точному английскому URL.
 */
export default async function ProtocolPage({
  params,
}: EnglishProtocolPageProps): Promise<ReactElement> {
  return <ProtocolScreen locale="en" protocol={(await params).protocol} />;
}
