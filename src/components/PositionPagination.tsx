import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronIcon } from './NativeIcons';
import { uiColors } from '../theme/colors';

export function getPageCount(itemCount: number, pageSize: number): number {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  return Math.max(1, Math.ceil(itemCount / normalizedPageSize));
}

export function clampPage(page: number, itemCount: number, pageSize: number): number {
  const pageCount = getPageCount(itemCount, pageSize);
  return Math.min(Math.max(0, page), pageCount - 1);
}

export function getPageItems<T>({ items, page, pageSize }: { items: T[]; page: number; pageSize: number }): T[] {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const normalizedPage = clampPage(page, items.length, normalizedPageSize);
  const start = normalizedPage * normalizedPageSize;
  return items.slice(start, start + normalizedPageSize);
}

export function PositionPagination({
  itemLabel,
  onPageChange,
  page,
  pageCount,
  pageSize,
  totalItems,
}: {
  itemLabel: string;
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
}) {
  if (totalItems <= pageSize) return null;

  const from = page * pageSize + 1;
  const to = Math.min(totalItems, (page + 1) * pageSize);
  const canGoPrevious = page > 0;
  const canGoNext = page < pageCount - 1;

  return (
    <View
      className="mt-3 flex-row items-center justify-between border-t pt-3"
      style={{ borderTopColor: uiColors.divider }}
    >
      <Text className="text-sm leading-5" style={{ color: uiColors.textMuted }}>
        {from}-{to} of {totalItems} {itemLabel}
      </Text>
      <View className="flex-row items-center">
        <PaginationButton disabled={!canGoPrevious} onPress={() => onPageChange(page - 1)}>
          <ChevronIcon
            color={canGoPrevious ? uiColors.textSecondary : uiColors.disabledText}
            direction="left"
            size={14}
          />
        </PaginationButton>
        <Text className="min-w-14 text-center text-sm leading-5" style={{ color: uiColors.textMuted }}>
          {page + 1}/{pageCount}
        </Text>
        <PaginationButton disabled={!canGoNext} onPress={() => onPageChange(page + 1)}>
          <ChevronIcon color={canGoNext ? uiColors.textSecondary : uiColors.disabledText} direction="right" size={14} />
        </PaginationButton>
      </View>
    </View>
  );
}

function PaginationButton({
  children,
  disabled,
  onPress,
}: {
  children: ReactNode;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className="h-8 w-8 items-center justify-center rounded-full border"
      style={{
        backgroundColor: disabled ? uiColors.disabledBg : uiColors.panelSoft,
        borderColor: uiColors.border,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </Pressable>
  );
}
