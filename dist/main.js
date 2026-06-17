"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const corsOptions = { origin: config_1.config.corsOrigins, credentials: true };
app.options('*', (0, cors_1.default)(corsOptions));
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/media', express_1.default.static(path_1.default.join(process.cwd(), 'media')));
app.use('/api', routes_1.default);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.listen(config_1.config.port, () => {
    console.log(`Server running on port ${config_1.config.port} [${config_1.config.nodeEnv}]`);
});
exports.default = app;
//# sourceMappingURL=main.js.map