import type { ReactElement } from 'react';
import { NotFoundScreen } from 'compositions/screens/not-found';
import { RootDocument } from './document';
import { metadataMessages } from './config/messages';

export const metadata = {
  title: metadataMessages.notFound,
  robots: { index: false },
};

/**
 * Предлагает вернуться на главную при обращении к неизвестному маршруту.
 */
export default function NotFoundPage(): ReactElement {
  return (
    <RootDocument locale="en">
      <NotFoundScreen />
    </RootDocument>
  );
}
