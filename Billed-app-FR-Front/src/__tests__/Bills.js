/**
 * @jest-environment jsdom
 */

import { screen, waitFor } from "@testing-library/dom"
import BillsUI from "../views/BillsUI.js"
import { bills } from "../fixtures/bills.js"
import { ROUTES, ROUTES_PATH } from "../constants/routes.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import '@testing-library/jest-dom';
import Bills from "../containers/Bills.js";
import userEvent from "@testing-library/user-event";
import mockStore from "../__mocks__/store";
jest.mock("../app/store", () => mockStore);
import router from "../app/Router.js";


describe("Étant donné que je suis connecté en tant qu'employé", () => {
  describe("Quand je suis sur la page des factures", () => {
    test("Ensuite, l'icône de facture dans la disposition verticale doit être mise en surbrillance", async () => {

      Object.defineProperty(window, 'localStorage', { value: localStorageMock })
      window.localStorage.setItem('user', JSON.stringify({
        type: 'Employee'
      }))
      const root = document.createElement("div")
      root.setAttribute("id", "root")
      document.body.append(root)
      router()
      window.onNavigate(ROUTES_PATH.Bills)

      await waitFor(() => screen.getByTestId('icon-window'))
      const windowIcon = screen.getByTestId('icon-window')
      expect(windowIcon).toHaveClass('active-icon'); // Ajout pour vérifier que l'icône est active
    })
    test("Les factures doivent alors être classées de la plus ancienne à la plus récente", () => {
      document.body.innerHTML = BillsUI({ data: bills });
      const dates = screen
        .getAllByText(
          /^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/i
        )
        .map((a) => a.innerHTML);

      // Pour trier du plus ancien au plus récent (ordre croissant)
      console.log("Dates avant le tri:", dates);
      const antiChrono = (a, b) => (a > b ? 1 : -1);
      const datesSorted = [...dates].sort(antiChrono);
      console.log("Dates après le tri:", datesSorted);
      expect(dates).toEqual(datesSorted);
    });

test("Ensuite, handleClickNewBill doit être déclenché et accéder à la page NewBill", () => {
  const onNavigate = jest.fn();
  document.body.innerHTML = BillsUI({ data: bills });

  // Instanciation du container avec ses dépendances
  const billsContainer = new Bills({
    document,
    onNavigate,
    store: mockStore,
    localStorage: window.localStorage
  });

  // Simulation du clic sur le bouton
  const buttonNewBill = screen.getByTestId("btn-new-bill");
  const handleClickNewBill = jest.fn(billsContainer.handleClickNewBill);
  buttonNewBill.addEventListener("click", handleClickNewBill);
  userEvent.click(buttonNewBill);

  // Vérification que le handler est déclenché et que la navigation est bien appelée
  expect(handleClickNewBill).toHaveBeenCalled();
  expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH.NewBill);
});

describe("Lorsque je clique sur l'icône en forme d'œil", () => {
  test("Ensuite, une modale devrait s'ouvrir avec le justificatif", () => {
    document.body.innerHTML = BillsUI({ data: bills });

    const onNavigate = jest.fn();
    const billsContainer = new Bills({
      document,
      onNavigate,
      store: mockStore,
      localStorage: window.localStorage
    });

    // Mock de la méthode .modal() de Bootstrap via jQuery
    $.fn.modal = jest.fn();

    const iconEye = screen.getAllByTestId("icon-eye")[0];
    userEvent.click(iconEye); // Déclenche le click attaché dans le constructor

    expect($.fn.modal).toHaveBeenCalled(); // Vérifie que la modale a été appelée
  });
});
  })
})

// Erreurs 404 et 500
describe("Lorsque je suis sur la page Factures et que l'API échoue", () => {
  beforeEach(() => {
    jest.spyOn(mockStore, "bills"); // espionne la méthode bills()
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    window.localStorage.setItem("user", JSON.stringify({ type: "Employee" }));

    const root = document.createElement("div");
    root.setAttribute("id", "root");
    document.body.append(root);
    router();
  });

  test("Ensuite, il devrait afficher un message d'erreur 404", async () => {
    mockStore.bills.mockImplementationOnce(() => {
      return {
        list: () => Promise.reject(new Error("Erreur 404"))
      };
    });

    window.onNavigate(ROUTES_PATH.Bills);
    await waitFor(() => screen.getByText(/Erreur 404/));

    expect(screen.getByText(/Erreur 404/)).toBeTruthy();
  });

  test("Ensuite, il devrait afficher un message d'erreur 500", async () => {
    mockStore.bills.mockImplementationOnce(() => {
      return {
        list: () => Promise.reject(new Error("Erreur 500"))
      };
    });

    window.onNavigate(ROUTES_PATH.Bills);
    await waitFor(() => screen.getByText(/Erreur 500/));

    expect(screen.getByText(/Erreur 500/)).toBeTruthy();
  });
});