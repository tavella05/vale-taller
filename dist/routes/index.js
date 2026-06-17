"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const appointments_1 = __importDefault(require("./appointments"));
const inventory_1 = __importDefault(require("./inventory"));
const injectors_1 = __importDefault(require("./injectors"));
const router = (0, express_1.Router)();
router.use('/auth', auth_1.default);
router.use('/appointments', appointments_1.default);
router.use('/inventory', inventory_1.default);
router.use('/injectors', injectors_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map