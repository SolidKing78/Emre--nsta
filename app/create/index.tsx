import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { BottomSheet } from '@/components/common/BottomSheet';
import { CreateOptions } from '@/components/navigation/CreateOptions';
import { useT } from '@/i18n';

/** "+" tab press → Instagram-style create sheet over the current screen. */
export default function CreateSheetRoute() {
  const router = useRouter();
  const t = useT();
  const [visible, setVisible] = useState(true);
  const close = () => {
    setVisible(false);
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/home');
    }, 200);
  };
  // Swap this transparent modal for the target screen once the sheet has slid away.
  const navigate = (path: string) => {
    setVisible(false);
    setTimeout(() => router.replace(path as never), 200);
  };
  return (
    <BottomSheet visible={visible} onClose={close} title={t('create.title')}>
      <CreateOptions onNavigate={navigate} />
    </BottomSheet>
  );
}
