// alias-loader-ийг Node-ын модуль тайлагчид бүртгэнэ.
// `node --import ./scripts/lib/alias-register.mjs <script>` гэж дуудна.

import { register } from 'node:module';

register('./alias-loader.mjs', import.meta.url);
