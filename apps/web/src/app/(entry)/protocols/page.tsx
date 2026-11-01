import type { ReactElement } from 'react';
import { CatalogScreen } from 'compositions/screens/catalog/server';
import { routeMetadata } from '../../helpers/route-metadata';
import { metadataMessages } from '../../config/messages';

export const metadata = routeMetadata(
  metadataMessages.en.catalog,
  '/protocols/',
  'en',
);

/**
 * Подключает английский каталог к статическому URL.
 */
export default function CatalogPage(): ReactElement {
  return <CatalogScreen locale="en" />;
}
