import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlate, validPlate, publicPlate, maskedName, isValidCPF } from "../server/validation.js";

test("normaliza e valida placas sem abrir margem para consultas arbitrárias", () => {
  assert.equal(normalizePlate("  abc1d23 "), "ABC1D23");
  assert.equal(validPlate("ABC1D23"), true);
  assert.equal(validPlate("AB1D23"), false);
  assert.equal(validPlate("ABC1234"), true);
  assert.equal(validPlate("ABC1D23 or true"), false);
});

test("resposta pública nunca inclui nome e telefone completos", () => {
  const result = publicPlate("plate001234", {
    nome: "Silvana Duncan",
    telefone: "22992437225",
    placa: "LUI9G33",
    tipo: "carro",
    cidade: "Campos",
    estado: "RJ",
  });
  assert.equal(result.telefoneMascarado, "(**) *****-****");
  assert.equal(result.nomeMascarado, "S********");
  assert.equal(result.unlockAvailable, false);
  assert.equal("telefone" in result, false);
  assert.equal("nome" in result, false);
  assert.equal(maskedName(""), "********");
});

test("exige CPF real e impede números repetidos", () => {
  assert.equal(isValidCPF("529.982.247-25"), true);
  assert.equal(isValidCPF("111.111.111-11"), false);
  assert.equal(isValidCPF("123"), false);
});
