async function askQuestion() {
    const response = await fetch("http://localhost:3000/")
    if(response.ok){
        const data = await response.json()
        console.log(data)
        document.getElementById("askQuestion").textContent = JSON.stringify(data);
    } else {
        console.error(response.status)
    }
}
askQuestion()