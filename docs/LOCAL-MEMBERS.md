# Trying another member locally

Development and demo suppress outbound mail. The invitation form follows the
same successful-send flow as a deployed installation.

To try a separate local Member, first open the owner’s private `RER_OPEN` link,
then run `pnpm exec rer dev --as teammate` and open its link in the same browser.
This selects a separate local member; it does not accept an invitation for the
address entered in the form. Keep private sign-in links out of shared evidence.
