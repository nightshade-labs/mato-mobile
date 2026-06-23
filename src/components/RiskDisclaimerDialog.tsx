import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uiColors } from '../theme/colors';

const STORAGE_KEY = 'mato-risk-disclaimer-accepted';

function getTodayStorageValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function WarningIcon() {
  return (
    <View
      className="h-7 w-7 items-center justify-center rounded-full border"
      style={{ backgroundColor: uiColors.warningBg, borderColor: uiColors.warningBorder }}
    >
      <Text className="text-base font-black leading-5" style={{ color: uiColors.warningText }}>
        !
      </Text>
    </View>
  );
}

export function RiskDisclaimerDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkStoredAcceptance() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && stored !== getTodayStorageValue()) setOpen(true);
      } catch {
        if (mounted) setOpen(true);
      }
    }

    void checkStoredAcceptance();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAccept = useCallback(async () => {
    setOpen(false);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, getTodayStorageValue());
    } catch {
      // Storage failures should not trap the user behind a modal.
    }
  }, []);

  return (
    <Modal animationType="fade" onRequestClose={() => undefined} statusBarTranslucent transparent visible={open}>
      <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: uiColors.overlay }}>
        <View
          className="w-full rounded-xl border px-5 py-5"
          style={{
            backgroundColor: uiColors.drawerSurface,
            borderColor: uiColors.border,
            maxWidth: 420,
          }}
        >
          <View className="mb-4 flex-row items-center">
            <WarningIcon />
            <Text className="ml-3 flex-1 text-lg font-semibold leading-6" style={{ color: uiColors.textPrimary }}>
              Experimental Protocol
            </Text>
          </View>

          <Text className="text-sm leading-5" style={{ color: uiColors.textMuted }}>
            This application is in an early experimental phase. Liquidity is low and smart contracts have not been fully
            audited. There is a significant risk of losing some or all of your funds.
          </Text>

          <Pressable
            onPress={() => void handleAccept()}
            className="mt-5 h-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: uiColors.primary }}
          >
            <Text className="text-base font-semibold leading-6" style={{ color: uiColors.primaryText }}>
              I understand the risks
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
