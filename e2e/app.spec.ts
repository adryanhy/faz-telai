import { expect, test } from "@playwright/test";
import { enterRoom, expectVideoPlaying, newPerson, receivedAudio, uniqueRoomId } from "./helpers";

test.describe("início", () => {
  test("cria uma sala, pede o apelido e conecta", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Criar sala" }).click();

    await expect(page).toHaveURL(/\/sala\/[a-z]+-[a-z]+-[a-z0-9]{4}$/);
    await page.getByLabel("Apelido").fill("Bia");
    await page.getByRole("button", { name: "Entrar na sala" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Conectado" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Participantes" })).toContainText("Bia (você)");
  });

  test("entra numa sala colando o link", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Entrar numa sala").fill("https://faz-telai.onrender.com/sala/tatu-zen-ab12");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/sala\/tatu-zen-ab12$/);
  });

  test("mostra erro com código inválido", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Entrar numa sala").fill("isso não é uma sala");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText("Link ou código inválido")).toBeVisible();
  });

  test("lembra o apelido na próxima sala", async ({ page }) => {
    await enterRoom(page, uniqueRoomId("apelido"), "Bia");
    await page.goto(`/sala/${uniqueRoomId("outra")}`);
    await expect(page.getByRole("status").filter({ hasText: "Conectado" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Participantes" })).toContainText("Bia (você)");
  });
});

test.describe("compartilhar e assistir", () => {
  test("a tela e o áudio chegam em quem assiste", async ({ browser }) => {
    const roomId = uniqueRoomId("tela");
    const bia = await newPerson(browser, { audio: true });
    const caio = await newPerson(browser);
    await enterRoom(bia, roomId, "Bia");
    await enterRoom(caio, roomId, "Caio");

    await bia.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await expect(bia.getByText("Ao vivo", { exact: true }).first()).toBeVisible();

    await caio.getByRole("button", { name: "Assistir Bia" }).first().click();
    const tile = await expectVideoPlaying(caio, "Bia");

    // Áudio: chega pela conexão, com volume, e a tela não mostra "Sem áudio".
    await expect.poll(async () => (await receivedAudio(caio)).bytes, { timeout: 10_000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await receivedAudio(caio)).level).toBeGreaterThan(0);
    await expect(tile.getByText("Sem áudio")).toHaveCount(0);

    // Quem compartilha vê quem está assistindo.
    await expect(bia.getByText("Caio assistindo")).toBeVisible();
  });

  test("captura sem áudio avisa quem compartilha e quem assiste", async ({ browser }) => {
    const roomId = uniqueRoomId("mudo");
    const bia = await newPerson(browser, { audio: false });
    const caio = await newPerson(browser);
    await enterRoom(bia, roomId, "Bia");
    await enterRoom(caio, roomId, "Caio");

    await bia.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await expect(bia.getByText("Sua transmissão está sem som.")).toBeVisible();

    await caio.getByRole("button", { name: "Assistir Bia" }).first().click();
    const tile = await expectVideoPlaying(caio, "Bia");
    await expect(tile.getByText("Sem áudio")).toBeVisible();
  });

  test("parar e recomeçar: quem assistia volta a ver sozinho", async ({ browser }) => {
    const roomId = uniqueRoomId("volta");
    const bia = await newPerson(browser);
    const caio = await newPerson(browser);
    await enterRoom(bia, roomId, "Bia");
    await enterRoom(caio, roomId, "Caio");

    await bia.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await caio.getByRole("button", { name: "Assistir Bia" }).first().click();
    await expectVideoPlaying(caio, "Bia");

    await bia.getByRole("button", { name: "Parar" }).click();
    await expect(caio.getByText("Parou de compartilhar")).toBeVisible();

    await bia.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await expectVideoPlaying(caio, "Bia");
    await expect(caio.getByText("Parou de compartilhar")).toHaveCount(0);
  });

  test("os dois compartilhando ao mesmo tempo, cada um vendo o outro", async ({ browser }) => {
    const roomId = uniqueRoomId("duplo");
    const bia = await newPerson(browser);
    const caio = await newPerson(browser);
    await enterRoom(bia, roomId, "Bia");
    await enterRoom(caio, roomId, "Caio");

    await bia.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await caio.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await bia.getByRole("button", { name: "Assistir Caio" }).first().click();
    await caio.getByRole("button", { name: "Assistir Bia" }).first().click();

    await expectVideoPlaying(bia, "Caio");
    await expectVideoPlaying(caio, "Bia");
  });

  test("quando quem assiste sai, some da sala e da contagem", async ({ browser }) => {
    const roomId = uniqueRoomId("saida");
    const bia = await newPerson(browser);
    const caio = await newPerson(browser);
    await enterRoom(bia, roomId, "Bia");
    await enterRoom(caio, roomId, "Caio");

    await bia.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await caio.getByRole("button", { name: "Assistir Bia" }).first().click();
    await expect(bia.getByText("Caio assistindo")).toBeVisible();

    await caio.context().close();
    await expect(bia.getByText("Ninguém assistindo")).toBeVisible();
    await expect(bia.getByRole("complementary", { name: "Participantes" })).not.toContainText("Caio");
  });
});
