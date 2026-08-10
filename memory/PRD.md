# PRD — SFR Espace Client (Paiement CB & Login)

## Problème / Contexte
Web App SFR (Espace Client télécom). Itération : finaliser le flow de paiement carte bancaire depuis les factures impayées, et renforcer la page de connexion (erreurs + mot de passe/identifiant oublié). Reconstruit depuis le template (le code d'origine "sfr-card-reset" vivait dans un autre environnement inaccessible).

## Stack & Architecture
- Frontend : React 19 (JSX) + React Router 7 + Tailwind + Shadcn + framer-motion. Charte SFR (rouge #E2001A / blanc, coins nets, polices Outfit/Manrope).
- Backend : FastAPI (server.py monolithique), MongoDB (motor).
- Auth : JWT Bearer (localStorage si "Rester connecté", sinon sessionStorage). bcrypt.
- Emails : Resend managé (Emergent) pour reset mot de passe + rappel identifiant.
- PDF reçu : reportlab (charte SFR rouge/blanc).
- Paiement : SIMULÉ côté backend (décision réel/Stripe repoussée).

## Personas
- Client SFR consultant/réglant ses factures en ligne.

## Collections MongoDB
- users, invoices, transactions, password_resets (TTL 30 min).

## Implémenté (2026-06)
- Login avec message d'erreur clair, "Rester connecté", liens reset.
- Flows mot de passe oublié / reset (token 30 min) / identifiant oublié via email Resend.
- Dashboard (solde, compteurs), liste factures (impayées/payées, badges).
- Formulaire CB (masques, Luhn, MM/AA, CVV) → loader → succès (reçu: montant, date, référence, n° facture, IBAN masqué, PDF) OU échec (message + réessayer).
- Statut facture → "Payée" après paiement. Endpoint reçu PDF.
- Seed : client dacostakanan@gmail.com + 3 factures impayées + 1 payée.
- Tests : backend 18/18 pytest, frontend e2e 100% (testing agent iteration_1).

## Décisions repoussées (backlog)
- P1 : Choix paiement réel Stripe test vs simulation permanente (à trancher).
- P2 : Design avancé des emails transactionnels (template basique actuellement).
- P2 : 3DS (dépend de la décision Stripe).

## Next tasks
- Trancher Stripe vs simulation.
- Éventuel historique de paiements / téléchargement de factures PDF (pas seulement reçus).
