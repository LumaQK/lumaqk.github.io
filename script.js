document.getElementById("checker").addEventListener("click", function() {
    verifierReponse();
});

function verifierReponse() {
    var reponseUtilisateur = document.querySelector('input[name="reponse"]:checked');
    var messageReponse = document.getElementById("messageReponse");
    var boutonVerification = document.getElementById("checker");
    var question = document.querySelector("h1");
    
    var bonneReponse = document.getElementById("descriptionReponse").getAttribute("data-bonne-reponse");
    var description = document.getElementById("descriptionReponse").getAttribute("data-description");
    var lien = document.getElementById("lienSuivant").getAttribute("data-lien-suivant");

    if (reponseUtilisateur) {
        var reponseCorrecte = reponseUtilisateur.value === "true";
        if (reponseCorrecte) {
            messageReponse.innerHTML = '<span class="text-lime-500">' + bonneReponse + '</span><br>' + description;
            messageReponse.classList.remove("text-red-500"); // Réinitialiser la couleur du texte
            messageReponse.classList.add("text-white"); // Appliquer la couleur blanche
            question.parentNode.removeChild(question);
            var qcmForm = document.getElementById("qcmForm");
            qcmForm.parentNode.removeChild(qcmForm);
            
            boutonVerification.parentNode.removeChild(boutonVerification);
            
            var lienQuestionSuivante = document.createElement("a");
            lienQuestionSuivante.href = lien;
            lienQuestionSuivante.className = "flex justify-center";
            var boutonQuestionSuivante = document.createElement("button");
            boutonQuestionSuivante.textContent = "Question suivante";
            boutonQuestionSuivante.className = "bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 shadow-xl";
            lienQuestionSuivante.appendChild(boutonQuestionSuivante);
            messageReponse.parentNode.insertBefore(lienQuestionSuivante, messageReponse);
        } else {
            messageReponse.textContent = "Mauvaise réponse.";
            messageReponse.classList.remove("text-lime-500");
            messageReponse.classList.add("text-red-500");
        }
    } else {
        messageReponse.textContent = "Veuillez sélectionner une réponse.";
        messageReponse.classList.remove("text-lime-500");
        messageReponse.classList.add("text-red-500");
    }
}
