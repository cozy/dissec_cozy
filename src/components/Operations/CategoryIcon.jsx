import React, { useMemo } from 'react'
import iconUncategorized from 'assets/icons/categories/icon-cat-uncategorized.svg'
import iconTransportation from 'assets/icons/categories/icon-cat-transportation.svg'
import iconSupermarket from 'assets/icons/categories/icon-cat-supermarket.svg'
import iconPotentialTransfer from 'assets/icons/categories/icon-cat-potentialTransfer.svg'
import iconCheck from 'assets/icons/categories/icon-cat-check.svg'
import iconIncomeCat from 'assets/icons/categories/icon-cat-incomeCat.svg'
import iconKids from 'assets/icons/categories/icon-cat-kids.svg'
import iconTelecom from 'assets/icons/categories/icon-cat-telecom.svg'
import iconRestaurantsAndBars from 'assets/icons/categories/icon-cat-restaurantsAndBars.svg'

// TODO: Handle all icons, currently only those in tiny datasets
export const CategoryIcon = ({ category, ...props }) => {
  const icon = useMemo(() => {
    switch (category) {
      case '0':
        return iconUncategorized
      case '100':
        return iconPotentialTransfer
      case '200':
        return iconCheck
      case '200000':
        return iconIncomeCat
      case '200100':
        return 'incomeCat'
      case '200110':
        return 'activityIncome'
      case '200120':
        return 'replacementIncome'
      case '200130':
        return 'interests'
      case '200140':
        return 'dividends'
      case '200150':
        return 'donationsReceived'
      case '200160':
        return 'allocations'
      case '200170':
        return 'rentalIncome'
      case '200180':
        return 'additionalIncome'
      case '200190':
        return 'retirement'
      case '300':
        return 'atm'
      case '400000':
        return 'expenseTheme'
      case '400100':
        return 'dailyLife'
      case '400110':
        return iconSupermarket
      case '400111':
        return 'tobaccoPress'
      case '400112':
        return 'shoppingECommerce'
      case '400120':
        return 'consumerLoan'
      case '400130':
        return 'dressing'
      case '400140':
        return 'pets'
      case '400150':
        return iconTelecom
      case '400160':
        return 'snaksAndworkMeals'
      case '400170':
        return 'charity'
      case '400180':
        return 'giftsOffered'
      case '400190':
        return 'personalCare'
      case '400200':
        return iconTransportation
      case '400205':
        return 'vehiculePurchase'
      case '400210':
        return 'vehiculeLoan'
      case '400220':
        return 'vehiculeRental'
      case '400230':
        return 'vehiculeInsurance'
      case '400240':
        return 'vehiculeMaintenance'
      case '400250':
        return 'vehiculeGas'
      case '400260':
        return 'privateParking'
      case '400270':
        return 'parkingAndToll'
      case '400280':
        return 'publicTransportation'
      case '400290':
        return 'taxi'
      case '400300':
        return 'services'
      case '400310':
        return 'post'
      case '400320':
        return 'legalCounsel'
      case '400330':
        return 'homeAssistance'
      case '400340':
        return 'bankFees'
      case '400350':
        return 'financialAdvisor'
      case '400400':
        return iconKids
      case '400410':
        return 'kidsAllowance'
      case '400420':
        return 'schoolRestaurant'
      case '400430':
        return 'childCare'
      case '400440':
        return 'schoolInsurance'
      case '400450':
        return 'toysAndGifts'
      case '400460':
        return 'pensionPaid'
      case '400470':
        return iconKids
      case '400500':
        return 'tax'
      case '400510':
        return 'incomeTax'
      case '400520':
        return 'socialTax'
      case '400530':
        return 'wealthTax'
      case '400540':
        return 'realEstateTax'
      case '400600':
        return 'health'
      case '400610':
        return 'healthExpenses'
      case '400620':
        return 'healthInsurance'
      case '400700':
        return 'activities'
      case '400710':
        return 'activityFees'
      case '400720':
        return 'activityEquipments'
      case '400730':
        return 'activityLessons'
      case '400740':
        return 'electronicsAndMultimedia'
      case '400750':
        return 'booksMoviesMusic'
      case '400760':
        return 'hobbyAndPassion'
      case '400800':
        return 'goingOutAndTravel'
      case '400810':
        return iconRestaurantsAndBars
      case '400820':
        return 'goingOutEntertainment'
      case '400830':
        return 'goingOutCulture'
      case '400840':
        return 'travel'
      case '400850':
        return 'journey'
      case '400900':
        return 'educationAndTraining'
      case '400910':
        return 'tuition'
      case '400920':
        return 'eduBooksAndSupplies'
      case '400930':
        return 'studentLoan'
      case '400940':
        return 'eduLessons'
      case '401000':
        return 'homeAndRealEstate'
      case '401010':
        return 'realEstateLoan'
      case '401020':
        return 'rent'
      case '401030':
        return 'homeCharges'
      case '401040':
        return 'homeInsurance'
      case '401050':
        return 'homeImprovement'
      case '401060':
        return 'homeHardware'
      case '401070':
        return 'water'
      case '401080':
        return 'power'
      case '600000':
        return 'excludeFromBudgetTheme'
      case '600100':
        return 'excludeFromBudgetCat'
      case '600110':
        return 'internalTransfer'
      case '600120':
        return 'creditCardPayment'
      case '600130':
        return 'loanCredit'
      case '600140':
        return 'professionalExpenses'
      case '600150':
        return 'investmentBuySell'
      case '600160':
        return 'friendBorrowing'
      case '600170':
        return 'savings'
    }
  }, [category])

  return (
    <svg {...props}>
      <use xlinkHref={`#${icon.id}`} />
    </svg>
  )
}
