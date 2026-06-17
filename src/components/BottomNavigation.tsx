import { Pressable, Text, View } from 'react-native';
import { uiColors } from '../theme/colors';

export type BottomNavTab = 'trade' | 'market' | 'positions';

const NAV_ITEMS = [
  { icon: '◇', label: 'Trade', tab: 'trade' },
  { icon: '▤', label: 'Market', tab: 'market' },
  { icon: '◉', label: 'Positions', tab: 'positions' },
] as const;

export function BottomNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
}) {
  return (
    <View
      className="flex-row px-3 pt-2.5 pb-3 border-t"
      style={{ backgroundColor: uiColors.surface, borderTopColor: uiColors.border }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.tab === activeTab;
        return (
          <Pressable
            key={item.tab}
            onPress={() => onTabChange(item.tab)}
            className="flex-1 items-center rounded-xl py-2"
            style={{ backgroundColor: isActive ? uiColors.panelSoft : 'transparent' }}
          >
            <Text
              className="text-[18px] leading-5"
              style={{ color: isActive ? uiColors.accentText : uiColors.textSubtle }}
            >
              {item.icon}
            </Text>
            <Text
              className="mt-1 text-[11px] font-semibold leading-4"
              style={{ color: isActive ? uiColors.textPrimary : uiColors.textSubtle }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
