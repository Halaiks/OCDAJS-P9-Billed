
/**
 * @jest-environment jsdom
 */

import { screen, fireEvent, waitFor } from "@testing-library/dom";
import NewBillUI from "../views/NewBillUI.js";
import NewBill from "../containers/NewBill.js";
import { ROUTES_PATH } from "../constants/routes.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import mockStore from "../__mocks__/store";
import "@testing-library/jest-dom";

jest.mock("../app/store", () => mockStore);

describe("Étant donné que je suis connecté en tant qu'employé (sur la page NewBill)", () => {
  beforeEach(() => {
    // Simule l'utilisateur connecté
    Object.defineProperty(window, "localStorage", { value: localStorageMock });
    window.localStorage.setItem("user", JSON.stringify({ type: "Employee", email: "test@company.com" }));

    // Simule le DOM de la page
    document.body.innerHTML = NewBillUI();
    window.alert = jest.fn(); // Empêche l'alerte réelle
  });

  test("Affiche correctement le formulaire", () => {
    expect(screen.getByText("Envoyer une note de frais")).toBeTruthy();
  });

  test("Soumet le formulaire et redirige vers Bills", async () => {
    const onNavigate = jest.fn();

    const newBill = new NewBill({ document, onNavigate, store: mockStore, localStorage: window.localStorage });

    // Remplit manuellement les données du formulaire
    newBill.fileUrl = "https://localhost/fake.jpg";
    newBill.fileName = "fake.jpg";
    newBill.billId = "12345";

    fireEvent.change(screen.getByTestId("expense-type"), { target: { value: "Transports" } });
    fireEvent.change(screen.getByTestId("expense-name"), { target: { value: "Vol Paris" } });
    fireEvent.change(screen.getByTestId("datepicker"), { target: { value: "2024-11-20" } });
    fireEvent.change(screen.getByTestId("amount"), { target: { value: "150" } });
    fireEvent.change(screen.getByTestId("vat"), { target: { value: "20" } });
    fireEvent.change(screen.getByTestId("pct"), { target: { value: "10" } });
    fireEvent.change(screen.getByTestId("commentary"), { target: { value: "Déplacement pro" } });

    const form = screen.getByTestId("form-new-bill");
    form.addEventListener("submit", (e) => newBill.handleSubmit(e));
    fireEvent.submit(form);

    expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH.Bills);
  });

  test("Accepte un fichier avec une extension valide", () => {
    const newBill = new NewBill({ document, onNavigate: jest.fn(), store: mockStore, localStorage: window.localStorage });
    const file = new File(["image"], "image.png", { type: "image/png" });
    const input = screen.getByTestId("file");

    fireEvent.change(input, { target: { files: [file] } });
    expect(input.files[0].name).toBe("image.png");
  });

  test("Rejette un fichier avec une extension invalide", () => {
    const newBill = new NewBill({ document, onNavigate: jest.fn(), store: mockStore, localStorage: window.localStorage });
    const file = new File(["test"], "document.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("file");

    fireEvent.change(input, { target: { files: [file] } });

    expect(window.alert).toHaveBeenCalledWith("Seuls les fichiers .jpg, .jpeg et .png sont autorisés.");
    expect(input.value).toBe("");
  });

  test("Envoie le fichier à l'API et met à jour les infos", async () => {
    const newBill = new NewBill({
      document,
      onNavigate: jest.fn(),
      store: {
        bills: () => ({
          create: jest.fn(() =>
            Promise.resolve({
              fileUrl: "https://localhost:3456/images/test.jpg",
              key: "1234",
            })
          ),
        }),
      },
      localStorage: window.localStorage,
    });

    const file = new File(["image"], "image.jpg", { type: "image/jpeg" });

    const event = {
      target: {
        files: [file],
        value: "C:\\fakepath\\image.jpg",
      },
      preventDefault: jest.fn(),
    };

    await newBill.handleChangeFile(event);

    expect(newBill.fileName).toBe("image.jpg");
    expect(newBill.fileUrl).toBe("https://localhost:3456/images/test.jpg");
    expect(newBill.billId).toBe("1234");
  });

  test("Affiche une erreur si la création échoue côté API", async () => {
    const errorStore = {
      bills: () => ({
        create: () => Promise.reject(new Error("Erreur 500")),
      }),
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const newBill = new NewBill({ document, onNavigate: jest.fn(), store: errorStore, localStorage: window.localStorage });

    const file = new File(["data"], "image.png", { type: "image/png" });

    const event = {
      target: {
        files: [file],
        value: file.name,
      },
      preventDefault: jest.fn(),
    };

    const input = screen.getByTestId("file");
    Object.defineProperty(input, "files", {
      value: [file],
      writable: false,
    });

    input.addEventListener("change", () => newBill.handleChangeFile(event));
    input.dispatchEvent(new Event("change"));

    await waitFor(() => expect(consoleSpy).toHaveBeenCalledTimes(1));
    expect(consoleSpy).toHaveBeenCalledWith(expect.objectContaining({ message: "Erreur 500" }));
    consoleSpy.mockRestore();
  });
});

// Erreurs 404 et 500
describe("Lorsque je crée une nouvelle facture et que l'API échoue", () => {
  beforeEach(() => {
    jest.spyOn(mockStore, "bills");
    Object.defineProperty(window, "localStorage", { value: localStorageMock });
    window.localStorage.setItem("user", JSON.stringify({ type: "Employee", email: "test@company.com" }));
    document.body.innerHTML = NewBillUI();
  });

  test("Il devrait alors enregistrer l'erreur 404", async () => {
    mockStore.bills.mockImplementationOnce(() => {
      return {
        update: () => Promise.reject(new Error("Erreur 404"))
      };
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const newBill = new NewBill({ document, onNavigate: jest.fn(), store: mockStore, localStorage: window.localStorage });

    const form = screen.getByTestId("form-new-bill");
    fireEvent.submit(form);

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));

    consoleSpy.mockRestore();
  });

  test("Il devrait alors enregistrer l’erreur 500", async () => {
    mockStore.bills.mockImplementationOnce(() => {
      return {
        update: () => Promise.reject(new Error("Erreur 500"))
      };
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const newBill = new NewBill({ document, onNavigate: jest.fn(), store: mockStore, localStorage: window.localStorage });

    const form = screen.getByTestId("form-new-bill");
    fireEvent.submit(form);

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));

    consoleSpy.mockRestore();
  });
});