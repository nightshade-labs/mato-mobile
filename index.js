// index.js
import 'react-native-get-random-values';
import './polyfill';
import 'expo-router/entry';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
