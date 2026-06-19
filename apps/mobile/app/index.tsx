import { Redirect } from "expo-router";

export default function authPage () {
    return (<Redirect href="/(tabs)/scans"></Redirect>);
}