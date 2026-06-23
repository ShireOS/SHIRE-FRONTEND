import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color_pallet } from '@/styles/colors';
import { typography } from '@/styles/typography';
import type { Restaurant } from '@shire/db';
import { getUserRestaraunts } from '../packages/supabase';

export default function HomePage() {
  const pfp =
    'https://static.vecteezy.com/system/resources/thumbnails/075/640/866/small/man-sitting-at-cafe-table-with-camera-and-tableware-in-foreground-urban-leisure-creative-lifestyle-streetgraphy-and-relaxed-social-atmosphere-photo.jpg';

  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const data = await getUserRestaraunts();
      if (!active) return;
      setRestaurants(data ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: color_pallet.bg.DEFAULT, justifyContent: 'flex-start' }}
    >
      <View
        style={{
          backgroundColor: color_pallet.bg.DEFAULT,
          marginLeft: 16,
          marginRight: 16,
          marginBottom: 16,
          flex: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Image
          source={{ uri: pfp }}
          style={{
            height: 45,
            width: 45,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: color_pallet.elevated.dark,
          }}
        />
        <Text style={[{ ...typography.h1, fontSize: 29 }, { color: '#151313' }]}>Shire</Text>
        <View style={{ width: 49 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}
      >
        <Text
          style={{
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: color_pallet.ink[500],
            fontFamily: 'FragmentMono_400Regular',
            marginBottom: 4,
          }}
        >
          Your restaurants
        </Text>

        {loading ? (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator color={color_pallet.sky[700]} />
          </View>
        ) : restaurants && restaurants.length > 0 ? (
          restaurants.map((r) => <RestaurantRow key={r.id} restaurant={r} />)
        ) : (
          <EmptyState />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RestaurantRow({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={restaurant.name}
      style={{
        backgroundColor: color_pallet.elevated.DEFAULT,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: color_pallet.stone[200],
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {restaurant.logo_url ? (
        <Image
          source={{ uri: restaurant.logo_url }}
          style={{ width: 40, height: 40, borderRadius: 8 }}
        />
      ) : (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: color_pallet.cream[200],
          }}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '500', color: color_pallet.ink[900] }} numberOfLines={1}>
          {restaurant.name}
        </Text>
        {restaurant.city && (
          <Text style={{ fontSize: 13, color: color_pallet.ink[500], marginTop: 2 }} numberOfLines={1}>
            {restaurant.city}
            {restaurant.state ? `, ${restaurant.state}` : ''}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View
      style={{
        paddingVertical: 32,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: color_pallet.stone[200],
        backgroundColor: color_pallet.cream[100],
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 14, color: color_pallet.ink[500], textAlign: 'center' }}>
        No restaurants assigned to your account yet.
      </Text>
    </View>
  );
}
