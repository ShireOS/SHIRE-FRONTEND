cd /Users/raghavunnam/Documents/joshik/programming/Projects/Shire/SHIRE-FRONTEND/apps/mobile
rm -rf ios
rm -rf ~/Library/Developer/Xcode/DerivedData/frontend-*
npx expo prebuild -p ios
npx expo run:ios --device