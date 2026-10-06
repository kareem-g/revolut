import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { F, Palette } from '../theme';

// A wheel picker: three visible rows, the middle one selected. Snaps on a
// fixed interval; the selection follows the scroll continuously so the
// highlight tracks the finger 1:1.

const ITEM = 44;
const VISIBLE = 3;

export function Wheel({
  items,
  index,
  onChange,
  palette,
  width,
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  palette: Palette;
  width: number;
}) {
  const ref = useRef<ScrollView>(null);
  const [sel, setSel] = useState(index);

  // external index changes (sheet reopened, draft reset)
  useEffect(() => {
    setSel(index);
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
  }, [index, items.length]);

  const clamp = (i: number) => Math.max(0, Math.min(items.length - 1, i));

  const fromOffset = (y: number) => clamp(Math.round(y / ITEM));

  return (
    <View style={{ width, height: ITEM * VISIBLE }}>
      <View
        pointerEvents="none"
        style={[
          styles.band,
          {
            top: ITEM,
            height: ITEM,
            backgroundColor: palette.surfaceHighest,
          },
        ]}
      />
      <ScrollView
        ref={ref}
        snapToInterval={ITEM}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ITEM }}
        onScroll={(e) => {
          const i = fromOffset(e.nativeEvent.contentOffset.y);
          if (i !== sel) setSel(i);
        }}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const i = fromOffset(e.nativeEvent.contentOffset.y);
          setSel(i);
          onChange(i);
        }}
        onScrollEndDrag={(e) => {
          // desktop / web fallback where momentum events may not fire
          const y = e.nativeEvent.contentOffset.y;
          if (e.nativeEvent.velocity?.y === 0) {
            const i = fromOffset(y);
            setSel(i);
            onChange(i);
          }
        }}>
        {items.map((label, i) => (
          <Text
            key={i}
            style={[
              styles.item,
              {
                color: i === sel ? palette.onSurface : palette.onSurfaceVariant,
                opacity: i === sel ? 1 : 0.45,
              },
            ]}>
            {label}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    start: 4,
    end: 4,
    borderRadius: 8,
  },
  item: {
    height: ITEM,
    lineHeight: ITEM,
    textAlign: 'center',
    fontFamily: F.monoSemi,
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
});
